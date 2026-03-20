"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { BenchmarkRun, BenchmarkStatus } from "@/types";

export interface LiveToolActivity {
  modelId: string;
  stage: "generate" | "revise";
  toolName: "search_web";
  state: "started" | "completed" | "failed";
  callId: string;
  turn?: number;
  query?: string;
  resultCount?: number;
  urls?: string[];
  error?: string;
}

export interface LiveReasoningActivity {
  modelId: string;
  stage: "generate" | "revise";
  detailId: string;
  turn?: number;
  detailType: "reasoning.summary" | "reasoning.encrypted" | "reasoning.text";
  format?: string;
  index?: number;
  text?: string;
  summary?: string;
  data?: string;
}

interface SSEState {
  runId: string | null;
  isRunning: boolean;
  status: BenchmarkStatus | null;
  step: string;
  result: BenchmarkRun | null;
  error: string | null;
  streamingText: Record<string, string>;
  toolActivity: Record<string, LiveToolActivity>;
  reasoningActivity: Record<string, LiveReasoningActivity>;
}

interface StartBenchmarkPayload {
  categoryId: string;
  prompt: string;
  selectedModelIds: string[];
  customModelIds: string[];
}

export function useBenchmarkSSE() {
  const [state, setState] = useState<SSEState>({
    runId: null,
    isRunning: false,
    status: null,
    step: "",
    result: null,
    error: null,
    streamingText: {},
    toolActivity: {},
    reasoningActivity: {},
  });
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeSource = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const connectToRun = useCallback((runId: string) => {
    closeSource();
    const source = new EventSource(`/api/benchmark/${runId}/events`);
    eventSourceRef.current = source;

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data);
        if (event.type === "token") {
          setState((prev) => ({
            ...prev,
            streamingText: {
              ...prev.streamingText,
              [event.modelId]: (prev.streamingText[event.modelId] ?? "") + event.chunk,
            },
          }));
          return;
        }

        if (event.type === "tool") {
          setState((prev) => ({
            ...prev,
            toolActivity: {
              ...prev.toolActivity,
              [`${event.stage}:${event.modelId}:${event.callId}`]: event,
            },
          }));
          return;
        }

        if (event.type === "reasoning") {
          setState((prev) => {
            const key = `${event.stage}:${event.modelId}:${event.detailId}`;
            const existing = prev.reasoningActivity[key];
            return {
              ...prev,
              reasoningActivity: {
                ...prev.reasoningActivity,
                [key]: {
                  modelId: event.modelId,
                  stage: event.stage,
                  detailId: event.detailId,
                  turn: event.turn ?? existing?.turn,
                  detailType: event.detailType,
                  format: event.format ?? existing?.format,
                  index: event.index ?? existing?.index,
                  text: `${existing?.text ?? ""}${event.text ?? ""}`,
                  summary: `${existing?.summary ?? ""}${event.summary ?? ""}`,
                  data: `${existing?.data ?? ""}${event.data ?? ""}`,
                },
              },
            };
          });
          return;
        }

        setState((prev) => {
          const nextStatus = event.status as BenchmarkStatus;
          const isTerminal = ["complete", "partial", "canceled", "dead_lettered", "error"].includes(nextStatus);
          if (isTerminal) {
            closeSource();
          }

          return {
            ...prev,
            runId,
            isRunning: !isTerminal && nextStatus !== "awaiting_human_critique",
            status: nextStatus,
            step: event.step || "",
            result: event.run ?? prev.result,
            error: nextStatus === "error" ? event.step || "Benchmark failed" : null,
            streamingText: nextStatus !== prev.status ? {} : prev.streamingText,
            toolActivity:
              nextStatus !== prev.status && !["generating", "revising"].includes(nextStatus)
                ? {}
                : prev.toolActivity,
            reasoningActivity:
              nextStatus !== prev.status && !["generating", "revising"].includes(nextStatus)
                ? {}
                : prev.reasoningActivity,
          };
        });
      } catch {
        // Ignore malformed chunks.
      }
    };

    source.onerror = () => {
      setState((prev) => ({
        ...prev,
        isRunning: false,
      }));
    };
  }, [closeSource]);

  const startBenchmark = useCallback(
    async ({ categoryId, prompt, selectedModelIds, customModelIds }: StartBenchmarkPayload) => {
      closeSource();
      setState({
        runId: null,
        isRunning: true,
        status: "queued",
        step: "Queueing benchmark...",
        result: null,
        error: null,
        streamingText: {},
        toolActivity: {},
        reasoningActivity: {},
      });

      const response = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          prompt,
          selectedModelIds,
          customModelIds,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      const payload = await response.json();
      connectToRun(payload.id);
      setState((prev) => ({ ...prev, runId: payload.id }));
      return payload.id as string;
    },
    [closeSource, connectToRun]
  );

  const performAction = useCallback(
    async (path: string, body?: unknown) => {
      if (!state.runId) return null;
      const response = await fetch(`/api/benchmark/${state.runId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (["retry", "resume", "proceed"].includes(path)) {
        connectToRun(state.runId);
      }
      setState((prev) => ({
        ...prev,
        result: payload ?? prev.result,
        status: payload?.status ?? prev.status,
        step: payload?.currentStep ?? prev.step,
        isRunning:
          payload?.status && !["complete", "partial", "canceled", "dead_lettered", "error", "awaiting_human_critique"].includes(payload.status)
            ? true
            : prev.isRunning,
      }));
      return payload;
    },
    [connectToRun, state.runId]
  );

  const reset = useCallback(() => {
    closeSource();
    setState({
      runId: null,
      isRunning: false,
      status: null,
      step: "",
      result: null,
        error: null,
        streamingText: {},
        toolActivity: {},
        reasoningActivity: {},
      });
  }, [closeSource]);

  return useMemo(
    () => ({
      ...state,
      startBenchmark,
      connectToRun,
      reset,
      cancelBenchmark: () => performAction("cancel"),
      proceedBenchmark: () => performAction("proceed"),
      resumeBenchmark: () => performAction("resume"),
      retryBenchmark: () => performAction("retry"),
      submitHumanCritiques: (critiques: unknown[]) => performAction("human-critiques", { critiques }),
      hasResults:
        state.result !== null &&
        (state.result.ideas.length > 0 ||
          state.result.critiqueVotes.length > 0 ||
          state.result.revisedIdeas.length > 0 ||
          state.result.finalRankings.length > 0 ||
          state.result.web.toolCalls.length > 0 ||
          state.result.reasoning.details.length > 0 ||
          Object.keys(state.toolActivity).length > 0 ||
          Object.keys(state.reasoningActivity).length > 0),
    }),
    [connectToRun, performAction, reset, startBenchmark, state]
  );
}
