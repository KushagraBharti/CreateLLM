import { ReasoningDetailRecord } from "@/types";
import { getOpenRouterCircuitBreaker } from "./circuit-breaker";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface PartialChatToolCall {
  index?: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface StreamDeltaChunk {
  choices?: {
    delta?: {
      content?: string;
      tool_calls?: PartialChatToolCall[];
      reasoning_details?: ReasoningDetail[];
    };
    finish_reason?: string | null;
  }[];
  error?: {
    message: string;
    code?: string | number;
  };
}

export interface ChatToolFunction {
  name: string;
  arguments: string;
}

export interface ChatToolCall {
  id: string;
  type: "function";
  function: ChatToolFunction;
}

export interface ReasoningDetail {
  id: string | null;
  type: ReasoningDetailRecord["type"];
  format?: string;
  index?: number;
  text?: string;
  summary?: string;
  data?: string;
  signature?: string | null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ChatToolCall[];
}

export interface ReasoningConfig {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  exclude?: boolean;
}

export interface ChatToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenRouterResponse {
  choices: {
    message: {
      content?: string | null;
      tool_calls?: ChatToolCall[];
      reasoning_details?: ReasoningDetail[];
    };
    finish_reason?: string | null;
  }[];
  error?: {
    message: string;
    code: number;
  };
}

export interface CallModelOptions {
  maxRetries?: number;
  reasoning?: ReasoningConfig;
  timeoutMs?: number;
  signal?: AbortSignal;
  onBeforeRequest?: (body: Record<string, unknown>) => void | Promise<void>;
  tools?: ChatToolDefinition[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  parallelToolCalls?: boolean;
}

const DEFAULT_TIMEOUT_MS = 90_000;

export function buildChatCompletionBody(
  openRouterId: string,
  messages: ChatMessage[],
  options: Pick<CallModelOptions, "reasoning" | "tools" | "toolChoice" | "parallelToolCalls"> & { stream?: boolean }
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: openRouterId,
    messages,
    temperature: 0.8,
  };

  if (options.stream) {
    body.stream = true;
  }

  if (options.reasoning) {
    body.reasoning = options.reasoning;
  }

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
    body.parallel_tool_calls = options.parallelToolCalls ?? false;
  }

  return body;
}

function timeoutSignal(ms: number, signal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Timeout after ${ms}ms`)), ms);

  signal?.addEventListener(
    "abort",
    () => {
      controller.abort(signal.reason);
      clearTimeout(timer);
    },
    { once: true }
  );

  controller.signal.addEventListener(
    "abort",
    () => clearTimeout(timer),
    { once: true }
  );

  return controller.signal;
}

async function requestOpenRouter(
  body: Record<string, unknown>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }

  const breaker = getOpenRouterCircuitBreaker();
  const gate = breaker.canRequest();
  if (!gate.ok) {
    throw new Error("OpenRouter circuit breaker is open");
  }

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://novelbench.dev",
        "X-Title": "NovelBench Creativity Benchmark",
      },
      body: JSON.stringify(body),
      signal: timeoutSignal(timeoutMs, signal),
    });

    if (!response.ok) {
      const text = await response.text();
      breaker.recordFailure(`OpenRouter API error (${response.status})`);
      throw new Error(`OpenRouter API error (${response.status}): ${text}`);
    }

    breaker.recordSuccess();
    return response;
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      breaker.recordFailure(error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
}

export async function callModel(
  openRouterId: string,
  messages: ChatMessage[],
  options: CallModelOptions = {}
): Promise<string> {
  const { maxRetries = 2, reasoning, timeoutMs = DEFAULT_TIMEOUT_MS, signal, onBeforeRequest } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const body = buildChatCompletionBody(openRouterId, messages, { reasoning, tools: options.tools, toolChoice: options.toolChoice, parallelToolCalls: options.parallelToolCalls });
      await onBeforeRequest?.(body);
      const response = await requestOpenRouter(body, timeoutMs, signal);
      const data: OpenRouterResponse = await response.json();

      if (data.error) {
        throw new Error(`OpenRouter error: ${data.error.message}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No content in OpenRouter response");
      }

      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (signal?.aborted) throw lastError;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("Unknown error calling OpenRouter");
}

export interface CallModelTurnResult {
  content: string;
  toolCalls: ChatToolCall[];
  finishReason?: string | null;
  reasoningDetails: ReasoningDetail[];
}

export async function callModelTurn(
  openRouterId: string,
  messages: ChatMessage[],
  options: CallModelOptions = {}
): Promise<CallModelTurnResult> {
  const {
    reasoning,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    onBeforeRequest,
    tools,
    toolChoice,
    parallelToolCalls,
  } = options;

  const body = buildChatCompletionBody(openRouterId, messages, {
    reasoning,
    tools,
    toolChoice,
    parallelToolCalls,
  });
  await onBeforeRequest?.(body);
  const response = await requestOpenRouter(body, timeoutMs, signal);
  const data: OpenRouterResponse = await response.json();

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  const choice = data.choices?.[0];
  const message = choice?.message;
  if (!message) {
    throw new Error("No message in OpenRouter response");
  }

  return {
    content: typeof message.content === "string" ? message.content : "",
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    finishReason: choice?.finish_reason,
    reasoningDetails: Array.isArray(message.reasoning_details) ? message.reasoning_details : [],
  };
}

function mergeReasoningDetail(
  target: Map<string, ReasoningDetail>,
  detail: ReasoningDetail,
  fallbackIndex: number
) {
  const key = detail.id ?? `${detail.type}:${detail.format ?? "unknown"}:${detail.index ?? fallbackIndex}`;
  const existing = target.get(key);
  if (!existing) {
    target.set(key, { ...detail, id: detail.id ?? key });
    return;
  }

  target.set(key, {
    ...existing,
    ...detail,
    id: existing.id ?? detail.id ?? key,
    text: `${existing.text ?? ""}${detail.text ?? ""}`,
    summary: `${existing.summary ?? ""}${detail.summary ?? ""}`,
    data: `${existing.data ?? ""}${detail.data ?? ""}`,
  });
}

function mergeToolCallDelta(target: Map<number, ChatToolCall>, partial: PartialChatToolCall) {
  const index = partial.index ?? target.size;
  const existing = target.get(index);
  const id = partial.id ?? existing?.id ?? `tool_call_${index}`;
  target.set(index, {
    id,
    type: "function",
    function: {
      name: partial.function?.name ?? existing?.function.name ?? "",
      arguments: `${existing?.function.arguments ?? ""}${partial.function?.arguments ?? ""}`,
    },
  });
}

export async function streamModelTurn(
  openRouterId: string,
  messages: ChatMessage[],
  options: CallModelOptions & {
    onContentChunk?: (chunk: string) => void;
    onReasoningDetails?: (details: ReasoningDetail[]) => void;
  } = {}
): Promise<CallModelTurnResult> {
  const {
    reasoning,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    onBeforeRequest,
    tools,
    toolChoice,
    parallelToolCalls,
    onContentChunk,
    onReasoningDetails,
  } = options;

  const body = buildChatCompletionBody(openRouterId, messages, {
    reasoning,
    stream: true,
    tools,
    toolChoice,
    parallelToolCalls,
  });
  await onBeforeRequest?.(body);

  const response = await requestOpenRouter(body, timeoutMs, signal);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | null | undefined;
  const toolCalls = new Map<number, ChatToolCall>();
  const reasoningDetails = new Map<string, ReasoningDetail>();

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw signal.reason instanceof Error ? signal.reason : new Error("Aborted");
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;

      let parsed: StreamDeltaChunk;
      try {
        parsed = JSON.parse(data) as StreamDeltaChunk;
      } catch {
        continue;
      }

      if (parsed.error?.message) {
        throw new Error(`OpenRouter stream error: ${parsed.error.message}`);
      }

      const choice = parsed.choices?.[0];
      const delta = choice?.delta;
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }

      if (delta?.content) {
        content += delta.content;
        onContentChunk?.(delta.content);
      }

      if (Array.isArray(delta?.tool_calls)) {
        for (const partial of delta.tool_calls) {
          mergeToolCallDelta(toolCalls, partial);
        }
      }

      if (Array.isArray(delta?.reasoning_details) && delta.reasoning_details.length > 0) {
        delta.reasoning_details.forEach((detail, index) => mergeReasoningDetail(reasoningDetails, detail, index));
        onReasoningDetails?.(delta.reasoning_details);
      }
    }
  }

  return {
    content,
    toolCalls: Array.from(toolCalls.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, value]) => value),
    finishReason,
    reasoningDetails: Array.from(reasoningDetails.values()).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0)
    ),
  };
}

export async function* streamModel(
  openRouterId: string,
  messages: ChatMessage[],
  options: CallModelOptions & { onReasoningDetails?: (details: ReasoningDetail[]) => void } = {}
): AsyncGenerator<string> {
  const { reasoning, timeoutMs = DEFAULT_TIMEOUT_MS, signal, onBeforeRequest, onReasoningDetails } = options;
  const body = buildChatCompletionBody(openRouterId, messages, {
    reasoning,
    stream: true,
    tools: options.tools,
    toolChoice: options.toolChoice,
    parallelToolCalls: options.parallelToolCalls,
  });
  await onBeforeRequest?.(body);

  const response = await requestOpenRouter(body, timeoutMs, signal);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    if (signal?.aborted) {
      await reader.cancel();
      throw signal.reason instanceof Error ? signal.reason : new Error("Aborted");
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      let parsed: StreamDeltaChunk;
      try {
        parsed = JSON.parse(data) as StreamDeltaChunk;
      } catch {
        continue;
      }
      if (parsed.error?.message) {
        throw new Error(`OpenRouter stream error: ${parsed.error.message}`);
      }
      const reasoningDetails = parsed.choices?.[0]?.delta?.reasoning_details;
      if (Array.isArray(reasoningDetails) && reasoningDetails.length > 0) {
        onReasoningDetails?.(reasoningDetails);
      }
      const chunk = parsed.choices?.[0]?.delta?.content;
      if (chunk) yield chunk;
    }
  }
}
