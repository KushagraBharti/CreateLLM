const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ReasoningConfig {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
  exclude?: boolean;
}

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
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
}

const DEFAULT_TIMEOUT_MS = 90_000; // 90 seconds per model call

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms: ${label}`)),
      ms
    );
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function callModel(
  openRouterId: string,
  messages: ChatMessage[],
  options: CallModelOptions = {}
): Promise<string> {
  const { maxRetries = 2, reasoning, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment variables");
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        model: openRouterId,
        messages,
        max_tokens: 4096,
        temperature: 0.8,
      };

      if (reasoning) {
        body.reasoning = reasoning;
      }

      const fetchPromise = fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://novelbench.dev",
          "X-Title": "NovelBench Creativity Benchmark",
        },
        body: JSON.stringify(body),
      });

      const response = await withTimeout(
        fetchPromise,
        timeoutMs,
        `${openRouterId} (attempt ${attempt + 1})`
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `OpenRouter API error (${response.status}): ${text}`
        );
      }

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
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("Unknown error calling OpenRouter");
}
