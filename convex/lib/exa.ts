"use node";

import type { SearchWebArgs, SearchWebResultItem } from "@/types";
import type { SearchWebPayload } from "@/lib/benchmark-web";

const EXA_SEARCH_API_URL = "https://api.exa.ai/search";

interface ExaSearchResult {
  title?: string;
  url: string;
  publishedDate?: string;
  score?: number;
  text?: string;
}

interface ExaSearchResponse {
  results?: ExaSearchResult[];
}

function clampMaxResults(value: number | undefined, defaultMax: number): number {
  const desired =
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : defaultMax;
  return Math.max(1, Math.min(defaultMax, desired));
}

function sanitizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function trimText(value: string | undefined, maxChars: number) {
  const normalized = (value ?? "").trim();
  if (normalized.length <= maxChars) {
    return { text: normalized, truncated: false };
  }

  return {
    text: `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`,
    truncated: true,
  };
}

function normalizeResult(
  result: ExaSearchResult,
  index: number,
  maxChars: number,
): SearchWebResultItem {
  const text = trimText(result.text, maxChars);
  const snippet = text.text.slice(0, 320);

  return {
    id: `${result.url}#${index}`,
    title: result.title?.trim() || domainFromUrl(result.url) || "Untitled source",
    url: result.url,
    domain: domainFromUrl(result.url),
    publishedDate: result.publishedDate,
    snippet,
    score: typeof result.score === "number" ? result.score : undefined,
    contentPreview: text.text,
    truncated: text.truncated,
  };
}

function mapCategoryHintToExaCategory(
  hint: SearchWebArgs["categoryHint"],
): "news" | "research paper" | "company" | "financial report" | undefined {
  switch (hint) {
    case "news":
      return "news";
    case "research":
      return "research paper";
    case "company":
      return "company";
    case "financial":
      return "financial report";
    default:
      return undefined;
  }
}

function buildExaSearchBody(
  args: SearchWebArgs,
  maxResults: number,
  maxChars: number,
): Record<string, unknown> {
  const category = mapCategoryHintToExaCategory(args.categoryHint);
  const body: Record<string, unknown> = {
    query: sanitizeQuery(args.query),
    numResults: maxResults,
    type: "auto",
    contents: {
      text: {
        maxCharacters: maxChars,
      },
    },
  };

  if (category) {
    body.category = category;
  }

  const supportsExcludeDomains = category !== "company";
  const supportsPublishedDateFilter = category !== "company";

  if (args.includeDomains?.length) {
    body.includeDomains = args.includeDomains.map((entry) => entry.trim()).filter(Boolean);
  }

  if (supportsExcludeDomains && args.excludeDomains?.length) {
    body.excludeDomains = args.excludeDomains.map((entry) => entry.trim()).filter(Boolean);
  }

  if (
    supportsPublishedDateFilter &&
    typeof args.freshnessDays === "number" &&
    Number.isFinite(args.freshnessDays) &&
    args.freshnessDays > 0
  ) {
    body.startPublishedDate = new Date(
      Date.now() - args.freshnessDays * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  return body;
}

export async function searchWebWithExaKey(
  apiKey: string,
  args: SearchWebArgs,
  options: {
    signal?: AbortSignal;
    maxResults?: number;
    maxCharsPerResult?: number;
    defaultMaxResults: number;
    defaultMaxCharsPerResult: number;
  },
): Promise<SearchWebPayload> {
  const query = sanitizeQuery(args.query);
  if (!query) {
    throw new Error("search_web requires a non-empty query");
  }

  const maxResults = clampMaxResults(options.maxResults, options.defaultMaxResults);
  const maxChars = Math.max(400, options.maxCharsPerResult ?? options.defaultMaxCharsPerResult);
  const body = buildExaSearchBody({ ...args, query }, maxResults, maxChars);

  const response = await fetch(EXA_SEARCH_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Exa search error (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as ExaSearchResponse;
  const results = (payload.results ?? [])
    .filter((entry) => typeof entry?.url === "string" && entry.url.trim().length > 0)
    .slice(0, maxResults)
    .map((entry, index) => normalizeResult(entry, index, maxChars));

  return {
    query,
    results,
  };
}
