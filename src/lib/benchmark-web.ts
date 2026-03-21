import type { ChatToolDefinition } from "./openrouter";
import type {
  BenchmarkWebSearchConfig,
  ModelStageWebUsageSummary,
  RetrievedSourceRecord,
  SearchWebArgs,
  SearchWebResultItem,
  StageWebTrace,
  ToolCallRecord,
  WebEnabledStage,
} from "@/types";

export interface SearchWebPayload {
  query: string;
  results: SearchWebResultItem[];
}

export const DEFAULT_WEB_SEARCH_CONFIG: BenchmarkWebSearchConfig = {
  maxSearchCallsPerStagePerModel: 2,
  maxResultsPerSearch: 3,
  maxCharsPerResult: 12_000,
  maxLoopTurns: 5,
};

export const SEARCH_WEB_TOOL: ChatToolDefinition = {
  type: "function",
  function: {
    name: "search_web",
    description:
      "Search the live web for information that could materially improve the current idea. Returns the top results with metadata, snippets, and bounded previews.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The exact search query to run.",
        },
        include_domains: {
          type: "array",
          items: { type: "string" },
          description: "Optional domains to prefer or restrict to.",
        },
        exclude_domains: {
          type: "array",
          items: { type: "string" },
          description: "Optional domains to exclude.",
        },
        freshness_days: {
          type: "number",
          description: "Optional recency filter in days.",
        },
        category_hint: {
          type: "string",
          enum: ["general", "news", "research", "company", "financial"],
          description: "Optional hint to shape the search.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export function supportsToolCallingError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("tool") ||
    message.includes("function call") ||
    message.includes("tool_choice") ||
    message.includes("parallel_tool_calls")
  );
}

export function normalizeSearchArgs(rawArgs: string): SearchWebArgs {
  const parsed = JSON.parse(rawArgs) as Record<string, unknown>;
  const toStringArray = (value: unknown): string[] | undefined =>
    Array.isArray(value)
      ? value.map((entry) => String(entry).trim()).filter(Boolean)
      : undefined;

  return {
    query: String(parsed.query ?? "").trim(),
    includeDomains: toStringArray(parsed.include_domains ?? parsed.includeDomains),
    excludeDomains: toStringArray(parsed.exclude_domains ?? parsed.excludeDomains),
    freshnessDays:
      typeof parsed.freshness_days === "number"
        ? parsed.freshness_days
        : typeof parsed.freshnessDays === "number"
          ? parsed.freshnessDays
          : undefined,
    categoryHint:
      typeof parsed.category_hint === "string"
        ? (parsed.category_hint as SearchWebArgs["categoryHint"])
        : typeof parsed.categoryHint === "string"
          ? (parsed.categoryHint as SearchWebArgs["categoryHint"])
          : undefined,
  };
}

export function dedupeSearchPayload(
  payload: SearchWebPayload,
  seenUrls: Set<string>,
): SearchWebPayload {
  const deduped = payload.results.filter((result) => {
    if (seenUrls.has(result.url)) {
      return false;
    }
    seenUrls.add(result.url);
    return true;
  });

  return {
    query: payload.query,
    results: deduped,
  };
}

export function toolMessageContent(payload: SearchWebPayload): string {
  return JSON.stringify(payload);
}

export function createEmptyWebUsage(
  stage: WebEnabledStage,
  modelId: string,
): ModelStageWebUsageSummary {
  return {
    stage,
    modelId,
    toolSupported: true,
    downgradedReason: undefined,
    usedSearch: false,
    searchCalls: 0,
    searchQueries: [],
    sourceCount: 0,
    totalLatencyMs: 0,
  };
}

export function createStageWebTrace(
  stage: WebEnabledStage,
  modelId: string,
): StageWebTrace {
  return {
    stage,
    modelId,
    toolCalls: [],
    retrievedSources: [],
    usage: createEmptyWebUsage(stage, modelId),
  };
}

export function sourceRecordFromResult(
  runId: string,
  modelId: string,
  stage: WebEnabledStage,
  query: string,
  result: SearchWebResultItem,
  retrievedAt = new Date().toISOString(),
): RetrievedSourceRecord {
  return {
    id: `${runId}_${stage}_${modelId}_${crypto.randomUUID()}`,
    stage,
    modelId,
    query,
    url: result.url,
    title: result.title,
    domain: result.domain,
    publishedDate: result.publishedDate,
    snippet: result.snippet,
    contentPreview: result.contentPreview,
    truncated: result.truncated,
    retrievedAt,
  };
}

export function formatPriorSourceSummary(records: RetrievedSourceRecord[]): string {
  if (records.length === 0) {
    return "";
  }

  return records
    .map((record, index) => {
      const snippet = record.snippet || record.contentPreview.slice(0, 220);
      return `${index + 1}. ${record.title || record.url}
URL: ${record.url}
Domain: ${record.domain || "unknown"}
Snippet: ${snippet}`.trim();
    })
    .join("\n\n");
}

export function mergeStageWebTraces(
  traces: StageWebTrace[],
  config: BenchmarkWebSearchConfig = DEFAULT_WEB_SEARCH_CONFIG,
) {
  const latestByStageAndModel = new Map<string, StageWebTrace>();

  for (const trace of traces) {
    latestByStageAndModel.set(`${trace.modelId}:${trace.stage}`, trace);
  }

  const ordered = Array.from(latestByStageAndModel.values()).sort((a, b) => {
    if (a.modelId !== b.modelId) {
      return a.modelId.localeCompare(b.modelId);
    }
    return a.stage.localeCompare(b.stage);
  });

  return {
    config,
    toolCalls: ordered.flatMap((trace) => trace.toolCalls as ToolCallRecord[]),
    retrievedSources: ordered.flatMap((trace) => trace.retrievedSources as RetrievedSourceRecord[]),
    usage: ordered.map((trace) => trace.usage as ModelStageWebUsageSummary),
  };
}
