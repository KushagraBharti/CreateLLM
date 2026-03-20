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
      tone: "neutral" | "warning";
      body: string;
    }
  | {
      kind: "tool";
      key: string;
      title: string;
      meta: string;
      tone: "accent" | "warning";
      body: string[];
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

  const activityEntries = useMemo<ActivityEntry[]>(() => {
    const reasoning = reasoningEntries.map((entry) => {
      const isEncrypted = entry.detailType === "reasoning.encrypted";
      const body = entry.detailType === "reasoning.summary"
        ? entry.summary || "Reasoning summary received."
        : isEncrypted
          ? "Reasoning was used for this turn, but the provider only returned encrypted reasoning details."
          : entry.text || "Reasoning details received.";

      return {
        kind: "reasoning" as const,
        key: entry.key,
        title:
          entry.detailType === "reasoning.summary"
            ? "Reasoning summary available"
            : isEncrypted
              ? "Reasoning used"
              : "Reasoning streamed",
        meta: entry.format ?? "reasoning",
        tone: isEncrypted ? "warning" as const : "neutral" as const,
        body,
      };
    });

    const tools = toolEntries.map((entry) => {
      const lines: string[] = [];
      if (entry.query) lines.push(`Query: ${entry.query}`);
      if (typeof entry.resultCount === "number") {
        lines.push(`${entry.resultCount} source${entry.resultCount === 1 ? "" : "s"} returned`);
      }
      if (entry.urls?.length) {
        lines.push(...entry.urls.map((url) => `Source: ${url}`));
      }
      if (entry.error) lines.push(`Error: ${entry.error}`);

      return {
        kind: "tool" as const,
        key: entry.key,
        title:
          entry.state === "failed"
            ? `${entry.toolName} tool failed`
            : entry.state === "completed"
              ? `${entry.toolName} tool called`
              : `${entry.toolName} tool called`,
        meta:
          entry.state === "completed"
            ? "completed"
            : entry.state === "failed"
              ? "failed"
              : "running",
        tone: entry.state === "failed" ? "warning" as const : "accent" as const,
        body: lines.length > 0 ? lines : ["Waiting for search results..."],
      };
    });

    return [...reasoning, ...tools];
  }, [reasoningEntries, toolEntries]);

  const stageLabel = stage === "generate" ? "generating" : "revising";
  const hasOutput = text.trim().length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-border bg-bg-surface/45"
    >
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: model.color,
              animation: "pulse-dot 1.5s ease-in-out infinite",
            }}
          />
          <div className="min-w-0">
            <p className="text-base font-medium text-text-primary">{model.name}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-text-muted">
              {stageLabel}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="label">Live Draft</p>
            <p className="text-sm text-text-muted">
              {hasOutput ? "Streaming proposal output" : "Preparing response"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="rounded-2xl border border-border/70 bg-bg-deep/65 p-4">
          {hasOutput ? (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words pr-1 font-mono text-[13px] leading-7 text-text-secondary">
              {text}
              <span
                className="ml-px inline-block h-[1em] w-0.5 align-middle"
                style={{
                  backgroundColor: "var(--color-accent)",
                  animation: "pulse-dot 1s ease-in-out infinite",
                }}
              />
            </pre>
          ) : (
            <div className="flex min-h-[92px] flex-col justify-center">
              <p className="label mb-2">Draft Queue</p>
              <div className="flex items-center gap-2">
                {[0, 0.18, 0.36].map((delay, index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 rounded-full bg-text-muted/40"
                    style={{ animation: `pulse-dot 1.2s ease-in-out ${delay}s infinite` }}
                  />
                ))}
                <span className="text-sm text-text-muted">
                  {activityEntries.length > 0
                    ? "The model is thinking, searching, or gathering context."
                    : "The model has the prompt and is starting its first draft."}
                </span>
              </div>
            </div>
          )}
        </div>

        {activityEntries.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-bg-surface/40">
            <div className="border-b border-border/60 px-4 py-3">
              <p className="label">Activity</p>
              <p className="text-sm text-text-muted">
                Reasoning and search events appear here as they happen.
              </p>
            </div>

            <div className="divide-y divide-border/50">
              {activityEntries.map((entry) => {
                const isOpen = openEntryId === entry.key;
                const accentClass =
                  entry.tone === "warning"
                    ? "bg-[#C87A7A]"
                    : entry.tone === "accent"
                      ? "bg-accent"
                      : "bg-text-muted/75";

                return (
                  <div key={entry.key} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenEntryId(isOpen ? null : entry.key)}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${accentClass}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary">{entry.title}</p>
                        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
                          {entry.meta}
                        </p>
                      </div>
                      <span className="text-sm text-text-muted">
                        {isOpen ? "Hide" : "Show"}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="ml-[18px] mt-3 rounded-xl border border-border/60 bg-bg-deep/70 px-4 py-3">
                        {entry.kind === "reasoning" ? (
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary">
                            {entry.body}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {entry.body.map((line) => (
                              <p
                                key={line}
                                className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-secondary"
                              >
                                {line}
                              </p>
                            ))}
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
      </div>
    </motion.div>
  );
}
