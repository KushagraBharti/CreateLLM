"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getModelIdentity } from "@/utils/model-identity";

interface StreamingCardProps {
  modelId: string;
  text: string;
  stage: "generate" | "revise";
  reasoningEntries?: Array<{
    key: string;
    detailType: "reasoning.summary" | "reasoning.encrypted" | "reasoning.text";
    text?: string;
    summary?: string;
    data?: string;
    format?: string;
  }>;
  toolEntries?: Array<{
    key: string;
    toolName: string;
    state: "started" | "completed" | "failed";
    query?: string;
    urls?: string[];
    resultCount?: number;
    error?: string;
  }>;
}

type ActivityEntry =
  | {
      kind: "reasoning";
      key: string;
      title: string;
      meta: string;
      accent: string;
      body: string;
    }
  | {
      kind: "tool";
      key: string;
      title: string;
      meta: string;
      accent: string;
      query?: string;
      note?: string;
      urls: string[];
      error?: string;
    };

export default function StreamingCard({
  modelId,
  text,
  stage,
  reasoningEntries = [],
  toolEntries = [],
}: StreamingCardProps) {
  const model = getModelIdentity(modelId);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const hasOutput = text.trim().length > 0;

  const activityEntries = useMemo<ActivityEntry[]>(() => {
    const reasoning = reasoningEntries.map((entry) => {
      const encrypted = entry.detailType === "reasoning.encrypted";

      return {
        kind: "reasoning" as const,
        key: entry.key,
        title:
          entry.detailType === "reasoning.summary"
            ? "Reasoning summary streamed"
            : encrypted
              ? "Reasoning used"
              : "Reasoning streamed",
        meta: entry.format ?? "reasoning",
        accent: encrypted ? "#C9A84C" : "rgba(255,255,255,0.25)",
        body:
          entry.detailType === "reasoning.summary"
            ? entry.summary || "Reasoning summary received."
            : encrypted
              ? "This provider used internal reasoning, but only returned encrypted reasoning details."
              : entry.text || "Reasoning details received.",
      };
    });

    const tools = toolEntries.map((entry) => ({
      kind: "tool" as const,
      key: entry.key,
      title: entry.state === "failed" ? `${entry.toolName} tool failed` : `${entry.toolName} tool called`,
      meta: entry.state,
      accent: entry.state === "failed" ? "#C75050" : "var(--color-accent)",
      query: entry.query,
      note:
        typeof entry.resultCount === "number"
          ? `${entry.resultCount} source${entry.resultCount === 1 ? "" : "s"} returned`
          : entry.state === "started"
            ? "Waiting for search results..."
            : undefined,
      urls: entry.urls ?? [],
      error: entry.error,
    }));

    return [...reasoning, ...tools];
  }, [reasoningEntries, toolEntries]);

  const hasReasoningActivity = activityEntries.some((entry) => entry.kind === "reasoning");
  const hasToolActivity = activityEntries.some((entry) => entry.kind === "tool");
  const outputPlaceholder = hasToolActivity
    ? "The model is still searching and gathering context before it starts drafting."
    : hasReasoningActivity
      ? "The model is still reasoning before it starts drafting."
      : "Prompt sent. Waiting for the first reasoning step, search, or draft tokens.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-border pb-6 last:border-0"
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: model.color,
            animation: "pulse-dot 1.5s ease-in-out infinite",
          }}
        />
        <span className="text-base font-medium text-text-primary">{model.name}</span>
        <span className="font-mono text-base tracking-wide text-text-muted">
          {stage === "generate" ? "Generating" : "Revising"}
        </span>
      </div>

      <div className="space-y-4">
        {activityEntries.length > 0 && (
          <div>
            <span className="label block mb-3">Live Activity</span>
            <div className="space-y-3">
              {activityEntries.map((entry) => {
                const isOpen = openEntryId === entry.key;
                return (
                  <div key={entry.key}>
                    <button
                      type="button"
                      onClick={() => setOpenEntryId(isOpen ? null : entry.key)}
                      className="flex w-full items-start gap-2.5 text-left"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.accent }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-base text-text-primary">{entry.title}</p>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
                          {entry.meta}
                        </p>
                      </div>
                      <span className="text-sm text-text-muted">{isOpen ? "Hide" : "Show"}</span>
                    </button>

                    {isOpen && (
                      <div className="ml-4 mt-2 border-l border-border pl-4">
                        {entry.kind === "reasoning" ? (
                          <div className="max-h-40 overflow-auto pr-2">
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">
                              {entry.body}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 text-sm leading-relaxed text-text-secondary">
                            {entry.query && (
                              <p>
                                <span className="label mr-2">Query</span>
                                {entry.query}
                              </p>
                            )}
                            {entry.note && <p className="text-text-muted">{entry.note}</p>}
                            {entry.urls.length > 0 && (
                              <div className="space-y-1.5">
                                {entry.urls.map((url) => (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block break-all text-text-secondary transition-colors hover:text-accent"
                                  >
                                    {url}
                                  </a>
                                ))}
                              </div>
                            )}
                            {entry.error && (
                              <p className="text-[#D8A8A8]">{entry.error}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={activityEntries.length > 0 ? "border-t border-border pt-4" : ""}>
          <span className="label block mb-2">Live Output</span>
          {hasOutput ? (
            <div className="max-h-72 overflow-auto pr-2">
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-7 text-text-secondary">
                {text}
                <span
                  className="ml-px inline-block h-[1em] w-0.5 align-middle"
                  style={{
                    backgroundColor: "var(--color-accent)",
                    animation: "pulse-dot 1s ease-in-out infinite",
                  }}
                />
              </pre>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-base text-text-muted">
              {[0, 0.18, 0.36].map((delay, index) => (
                <span
                  key={index}
                  className="h-1.5 w-1.5 rounded-full bg-text-muted/40"
                  style={{ animation: `pulse-dot 1.2s ease-in-out ${delay}s infinite` }}
                />
              ))}
              <span>{outputPlaceholder}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
