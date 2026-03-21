"use node";

import type {
  ChatMessage,
  ChatToolCall,
  ChatToolDefinition,
  ReasoningConfig,
} from "@/lib/openrouter";
import { buildChatCompletionBody } from "@/lib/openrouter";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 90_000;

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

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://novelbench.dev",
      "X-Title": "NovelBench Creativity Benchmark",
    },
    body: JSON.stringify(body),
    signal: timeoutSignal(args.timeoutMs ?? DEFAULT_TIMEOUT_MS, args.signal),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
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

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://novelbench.dev",
      "X-Title": "NovelBench Creativity Benchmark",
    },
    body: JSON.stringify(body),
    signal: timeoutSignal(args.timeoutMs ?? DEFAULT_TIMEOUT_MS, args.signal),
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
    usage: {
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    },
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
