"use node";

import type {
  ChatMessage,
  ChatToolCall,
  ChatToolDefinition,
  ReasoningConfig,
  ReasoningDetail,
} from "@/lib/openrouter";
import { buildChatCompletionBody } from "@/lib/openrouter";
import { MODEL_TIMEOUT_MS } from "@/lib/runtime-config";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = MODEL_TIMEOUT_MS;

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
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
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
    { once: true },
  );

  controller.signal.addEventListener(
    "abort",
    () => clearTimeout(timer),
    { once: true },
  );

  return controller.signal;
}

async function requestOpenRouterWithKey(args: {
  apiKey: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  timeoutMs?: number;
}) {
  return await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://novelbench.dev",
      "X-Title": "NovelBench Creativity Benchmark",
    },
    body: JSON.stringify(args.body),
    signal: timeoutSignal(args.timeoutMs ?? DEFAULT_TIMEOUT_MS, args.signal),
  });
}

function mergeReasoningDetail(
  target: Map<string, ReasoningDetail>,
  detail: ReasoningDetail,
  fallbackIndex: number,
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

export async function callOpenRouterWithKey(args: {
  apiKey: string;
  openRouterId: string;
  messages: ChatMessage[];
  reasoning?: ReasoningConfig;
  signal?: AbortSignal;
  timeoutMs?: number;
}) {
  const body = buildChatCompletionBody(args.openRouterId, args.messages, {
    reasoning: args.reasoning,
  });

  const response = await requestOpenRouterWithKey({
    apiKey: args.apiKey,
    body,
    signal: args.signal,
    timeoutMs: args.timeoutMs,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        reasoning_details?: ReasoningDetail[];
      };
    }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };
    error?: {
      message?: string;
    };
  };

  if (data.error?.message) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenRouter response");
  }

  return {
    raw: content,
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
    reasoningDetails: Array.isArray(data.choices?.[0]?.message?.reasoning_details)
      ? data.choices?.[0]?.message?.reasoning_details
      : [],
  };
}

export async function callOpenRouterTurnWithKey(args: {
  apiKey: string;
  openRouterId: string;
  messages: ChatMessage[];
  reasoning?: ReasoningConfig;
  tools?: ChatToolDefinition[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  parallelToolCalls?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}) {
  const body = buildChatCompletionBody(args.openRouterId, args.messages, {
    reasoning: args.reasoning,
    tools: args.tools,
    toolChoice: args.toolChoice,
    parallelToolCalls: args.parallelToolCalls,
  });

  const response = await requestOpenRouterWithKey({
    apiKey: args.apiKey,
    body,
    signal: args.signal,
    timeoutMs: args.timeoutMs,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        tool_calls?: ChatToolCall[];
        reasoning_details?: ReasoningDetail[];
      };
      finish_reason?: string | null;
    }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
    };
    error?: {
      message?: string;
    };
  };

  if (data.error?.message) {
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
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

export async function streamOpenRouterWithKey(args: {
  apiKey: string;
  openRouterId: string;
  messages: ChatMessage[];
  reasoning?: ReasoningConfig;
  signal?: AbortSignal;
  timeoutMs?: number;
  onContentChunk?: (chunk: string) => void | Promise<void>;
  onReasoningDetails?: (details: ReasoningDetail[]) => void | Promise<void>;
}) {
  const body = buildChatCompletionBody(args.openRouterId, args.messages, {
    reasoning: args.reasoning,
    stream: true,
  });

  const response = await requestOpenRouterWithKey({
    apiKey: args.apiKey,
    body,
    signal: args.signal,
    timeoutMs: args.timeoutMs,
  });
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const reasoningDetails = new Map<string, ReasoningDetail>();
  let usage = {
    inputTokens: 0,
    outputTokens: 0,
  };

  while (true) {
    if (args.signal?.aborted) {
      await reader.cancel();
      throw args.signal.reason instanceof Error ? args.signal.reason : new Error("Aborted");
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

      if (parsed.usage) {
        usage = {
          inputTokens: parsed.usage.prompt_tokens ?? usage.inputTokens,
          outputTokens: parsed.usage.completion_tokens ?? usage.outputTokens,
        };
      }

      const delta = parsed.choices?.[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        await args.onContentChunk?.(delta.content);
      }

      if (Array.isArray(delta?.reasoning_details) && delta.reasoning_details.length > 0) {
        delta.reasoning_details.forEach((detail, index) =>
          mergeReasoningDetail(reasoningDetails, detail, index),
        );
        await args.onReasoningDetails?.(delta.reasoning_details);
      }
    }
  }

  return {
    raw: content,
    usage,
    reasoningDetails: Array.from(reasoningDetails.values()).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    ),
  };
}

export async function streamOpenRouterTurnWithKey(args: {
  apiKey: string;
  openRouterId: string;
  messages: ChatMessage[];
  reasoning?: ReasoningConfig;
  tools?: ChatToolDefinition[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  parallelToolCalls?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  onContentChunk?: (chunk: string) => void | Promise<void>;
  onReasoningDetails?: (details: ReasoningDetail[]) => void | Promise<void>;
}) {
  const body = buildChatCompletionBody(args.openRouterId, args.messages, {
    reasoning: args.reasoning,
    stream: true,
    tools: args.tools,
    toolChoice: args.toolChoice,
    parallelToolCalls: args.parallelToolCalls,
  });

  const response = await requestOpenRouterWithKey({
    apiKey: args.apiKey,
    body,
    signal: args.signal,
    timeoutMs: args.timeoutMs,
  });
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason: string | null | undefined;
  const toolCalls = new Map<number, ChatToolCall>();
  const reasoningDetails = new Map<string, ReasoningDetail>();
  let usage = {
    inputTokens: 0,
    outputTokens: 0,
  };

  while (true) {
    if (args.signal?.aborted) {
      await reader.cancel();
      throw args.signal.reason instanceof Error ? args.signal.reason : new Error("Aborted");
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

      if (parsed.usage) {
        usage = {
          inputTokens: parsed.usage.prompt_tokens ?? usage.inputTokens,
          outputTokens: parsed.usage.completion_tokens ?? usage.outputTokens,
        };
      }

      const choice = parsed.choices?.[0];
      const delta = choice?.delta;
      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }

      if (delta?.content) {
        content += delta.content;
        await args.onContentChunk?.(delta.content);
      }

      if (Array.isArray(delta?.tool_calls)) {
        for (const partial of delta.tool_calls) {
          mergeToolCallDelta(toolCalls, partial);
        }
      }

      if (Array.isArray(delta?.reasoning_details) && delta.reasoning_details.length > 0) {
        delta.reasoning_details.forEach((detail, index) =>
          mergeReasoningDetail(reasoningDetails, detail, index),
        );
        await args.onReasoningDetails?.(delta.reasoning_details);
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
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    ),
    usage,
  };
}

export function estimateOpenRouterCostUsd(args: {
  inputTokens: number;
  outputTokens: number;
  pricing?: {
    inputPerMillion?: number;
    outputPerMillion?: number;
  };
}) {
  const inputCost = ((args.pricing?.inputPerMillion ?? 0) / 1_000_000) * args.inputTokens;
  const outputCost = ((args.pricing?.outputPerMillion ?? 0) / 1_000_000) * args.outputTokens;
  return inputCost + outputCost;
}
