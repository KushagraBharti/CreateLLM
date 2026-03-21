"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { BenchmarkRun, BenchmarkStatus } from "@/types";
import { api } from "../../convex/_generated/api";

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
  const liveRun = useQuery(
    api.runs.get,
    state.runId
      ? {
          runId: state.runId as never,
        }
      : "skip"
  );
  const liveEvents = useQuery(
    api.runs.liveActivity,
    state.runId
      ? {
          runId: state.runId as never,
        }
      : "skip"
  );

  useEffect(() => {
    if (liveRun === undefined || !liveRun) return;

    setState((prev) => {
      const statusChanged = prev.status !== liveRun.status;
      const isStreamingStage = ["generating", "revising"].includes(liveRun.status);

      return {
        ...prev,
        runId: liveRun.id,
        isRunning: ["queued", "generating", "critiquing", "revising", "voting"].includes(liveRun.status),
        status: liveRun.status,
        step: liveRun.currentStep,
        result: liveRun,
        error: liveRun.status === "error" ? liveRun.error ?? liveRun.currentStep : null,
        streamingText: statusChanged ? {} : prev.streamingText,
        toolActivity: statusChanged && !isStreamingStage ? {} : prev.toolActivity,
        reasoningActivity: statusChanged && !isStreamingStage ? {} : prev.reasoningActivity,
      };
    });
  }, [liveRun]);

  useEffect(() => {
    if (!liveEvents) return;

    const nextStreamingText: Record<string, string> = {};
    const nextToolActivity: Record<string, LiveToolActivity> = {};
    const nextReasoningActivity: Record<string, LiveReasoningActivity> = {};

    for (const event of liveEvents as Array<{
      kind: string;
      stage: "generate" | "revise";
      participantModelId?: string;
      payload?: {
        chunk?: string;
        state?: "started" | "completed" | "failed";
        toolName?: "search_web";
        callId?: string;
        turn?: number;
        query?: string;
        resultCount?: number;
        urls?: string[];
        error?: string;
        detailId?: string;
        detailType?: "reasoning.summary" | "reasoning.encrypted" | "reasoning.text";
        format?: string;
        index?: number;
        text?: string;
        summary?: string;
        data?: string;
      } | null;
    }>) {
      if (!event.participantModelId) continue;

      if (event.kind === "live_token") {
        nextStreamingText[event.participantModelId] =
          (nextStreamingText[event.participantModelId] ?? "") + String(event.payload?.chunk ?? "");
        continue;
      }

      if (event.kind === "tool_call_activity" && event.payload?.callId && event.payload.toolName && event.payload.state) {
        const key = `${event.stage}:${event.participantModelId}:${event.payload.callId}`;
        nextToolActivity[key] = {
          modelId: event.participantModelId,
          stage: event.stage,
          toolName: event.payload.toolName,
          state: event.payload.state,
          callId: event.payload.callId,
          turn: event.payload.turn,
          query: event.payload.query,
          resultCount: event.payload.resultCount,
          urls: event.payload.urls,
          error: event.payload.error,
        };
        continue;
      }

      if (event.kind === "reasoning_detail" && event.payload?.detailId && event.payload.detailType) {
        const key = `${event.stage}:${event.participantModelId}:${event.payload.detailId}`;
        const existing = nextReasoningActivity[key];
        nextReasoningActivity[key] = {
          modelId: event.participantModelId,
          stage: event.stage,
          detailId: event.payload.detailId,
          turn: event.payload.turn ?? existing?.turn,
          detailType: event.payload.detailType,
          format: event.payload.format ?? existing?.format,
          index: event.payload.index ?? existing?.index,
          text: `${existing?.text ?? ""}${event.payload.text ?? ""}` || undefined,
          summary: `${existing?.summary ?? ""}${event.payload.summary ?? ""}` || undefined,
          data: `${existing?.data ?? ""}${event.payload.data ?? ""}` || undefined,
        };
      }
    }

    setState((prev) => ({
      ...prev,
      streamingText: nextStreamingText,
      toolActivity: nextToolActivity,
      reasoningActivity: nextReasoningActivity,
    }));
  }, [liveEvents]);

  const connectToRun = useCallback((runId: string) => {
    setState((prev) => ({
      ...prev,
      runId,
      error: null,
      streamingText: {},
      toolActivity: {},
      reasoningActivity: {},
    }));
  }, []);

  const startBenchmark = useCallback(
    async ({ categoryId, prompt, selectedModelIds, customModelIds }: StartBenchmarkPayload) => {
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

      try {
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
        setState((prev) => ({
          ...prev,
          runId: payload.id,
          result: payload,
          status: payload.status ?? prev.status,
          step: payload.currentStep ?? prev.step,
          error: null,
        }));
        return payload.id as string;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to start benchmark";
        setState((prev) => ({
          ...prev,
          isRunning: false,
          status: null,
          step: "",
          error: message,
        }));
        return null;
      }
    },
    []
  );

  const attachToRun = useCallback(
    (run: BenchmarkRun) => {
      setState((prev) => ({
        ...prev,
        runId: run.id,
        result: run,
        status: run.status,
        step: run.currentStep,
        error: run.status === "error" ? run.error ?? run.currentStep : null,
        isRunning: ["queued", "generating", "critiquing", "revising", "voting"].includes(run.status),
      }));
    },
    []
  );

  const performAction = useCallback(
    async (path: string, body?: unknown) => {
      if (!state.runId) return null;
      try {
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
        const nextRunId = payload?.id ?? state.runId;
        setState((prev) => ({
          ...prev,
          result: payload ?? prev.result,
          runId: nextRunId,
          status: payload?.status ?? prev.status,
          step: payload?.currentStep ?? prev.step,
          error: null,
          isRunning: payload?.status
            ? ["queued", "generating", "critiquing", "revising", "voting"].includes(payload.status)
            : prev.isRunning,
        }));
        return payload;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Run action failed";
        setState((prev) => ({
          ...prev,
          error: message,
        }));
        return null;
      }
    },
    [state.runId]
  );

  const reset = useCallback(() => {
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
  }, []);

  return useMemo(
    () => ({
      ...state,
      startBenchmark,
      attachToRun,
      connectToRun,
      reset,
      pauseBenchmark: () => performAction("pause"),
      cancelBenchmark: () => performAction("cancel"),
      proceedBenchmark: () => performAction("proceed"),
      resumeBenchmark: () => performAction("resume"),
      restartBenchmark: () => performAction("restart"),
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
    [attachToRun, connectToRun, performAction, reset, startBenchmark, state]
  );
}
