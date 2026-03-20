import { executeBenchmarkRun } from "./engine";
import { createCheckpointForStage, getBenchmarkRepository, loadBenchmarkRun, updateBenchmarkRun } from "./storage";
import { getRunEventBus } from "./run-events";
import { BenchmarkRun, CreateBenchmarkRunInput, HumanCritiqueEntry } from "@/types";

function publishRunSnapshot(run: BenchmarkRun) {
  getRunEventBus().setSnapshot(run);
  getRunEventBus().publishProgress({
    status: run.status,
    step: run.currentStep,
    run,
  });
}

class RunScheduler {
  private queue: string[] = [];
  private running = new Set<string>();
  private abortControllers = new Map<string, Map<string, AbortController>>();
  private bootstrapped = false;

  async bootstrap() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;

    const resumable = await getBenchmarkRepository().listRunsByStatus([
      "queued",
      "paused",
      "generating",
      "critiquing",
      "revising",
      "voting",
    ]);

    for (const run of resumable) {
      if (run.status === "paused") {
        continue;
      }
      this.enqueue(run.id);
    }
  }

  enqueue(runId: string) {
    if (!this.queue.includes(runId) && !this.running.has(runId)) {
      this.queue.push(runId);
      queueMicrotask(() => void this.drain());
    }
  }

  async cancel(runId: string, reason = "Canceled by user") {
    const next = await updateBenchmarkRun(runId, (run) => ({
      ...markRunCanceled(run, reason),
    }));
    if (next) publishRunSnapshot(next);
    this.abortRun(runId, reason);
  }

  async pause(runId: string, reason = "Paused by user") {
    const next = await updateBenchmarkRun(runId, (run) => markRunPaused(run, reason));
    if (!next) throw new Error("Run not found");
    publishRunSnapshot(next);
    this.abortRun(runId, reason);
    return next;
  }

  async proceed(runId: string) {
    const run = await loadBenchmarkRun(runId);
    if (!run) throw new Error("Run not found");
    if (run.status !== "awaiting_human_critique") return run;

    await updateBenchmarkRun(runId, (current) => ({
      ...current,
      status: "queued",
      currentStep: "Queued for revision",
      checkpoint: {
        ...current.checkpoint,
        stage: "revise",
        updatedAt: new Date().toISOString(),
      },
    }));

    this.enqueue(runId);
    const next = await loadBenchmarkRun(runId);
    if (!next) return null;
    publishRunSnapshot(next);
    return next;
  }

  async addHumanCritiques(runId: string, critiques: Omit<HumanCritiqueEntry, "id" | "timestamp">[]) {
    const next = await updateBenchmarkRun(runId, (run) => ({
      ...run,
      humanCritiques: [
        ...run.humanCritiques,
        ...critiques.map((critique) => ({
          ...critique,
          id: `human_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
        })),
      ],
    }));

    if (!next) throw new Error("Run not found");
    publishRunSnapshot(next);
    return next;
  }

  async retry(runId: string) {
    return this.resume(runId);
  }

  async resume(runId: string) {
    const run = await loadBenchmarkRun(runId);
    if (!run) throw new Error("Run not found");
    if (run.status === "awaiting_human_critique") {
      throw new Error("Use proceed to continue from the human critique checkpoint.");
    }

    const next = await updateBenchmarkRun(runId, (current) => prepareRunForResume(current));
    if (!next) throw new Error("Run not found");
    publishRunSnapshot(next);
    this.enqueue(runId);
    return next;
  }

  async restart(runId: string) {
    const run = await loadBenchmarkRun(runId);
    if (!run) throw new Error("Run not found");

    const created = await getBenchmarkRepository().createRun({
      categoryId: run.categoryId,
      prompt: run.prompt,
      selectedModelIds: run.selectedModels.map((model) => model.id),
      customModelIds: run.selectedModels
        .filter((model) => !model.active)
        .map((model) => model.id),
    });

    const restartedRun = await updateBenchmarkRun(created.id, (current) => ({
      ...current,
      controls: {
        ...current.controls,
        restartSourceRunId: run.id,
      },
    }));

    await updateBenchmarkRun(runId, (current) => appendHistory(current, "run", "restart", undefined, "User restarted run"));
    if (!restartedRun) throw new Error("Failed to create restarted run");
    publishRunSnapshot(restartedRun);
    this.enqueue(restartedRun.id);
    return restartedRun;
  }

  async pauseModel(runId: string, modelId: string, reason = "Paused by user") {
    const next = await updateBenchmarkRun(runId, (run) => markModelPaused(run, modelId, reason));
    if (!next) throw new Error("Run not found");
    publishRunSnapshot(next);
    this.abortModel(runId, modelId, reason);
    return next;
  }

  async resumeModel(runId: string, modelId: string) {
    const next = await updateBenchmarkRun(runId, (run) => resumeModelState(run, modelId));
    if (!next) throw new Error("Run not found");
    publishRunSnapshot(next);
    if (!this.running.has(runId)) {
      this.enqueue(runId);
    }
    return next;
  }

  async retryModel(runId: string, modelId: string) {
    const next = await updateBenchmarkRun(runId, (run) => retryModelStage(run, modelId));
    if (!next) throw new Error("Run not found");
    publishRunSnapshot(next);
    if (!this.running.has(runId)) {
      this.enqueue(runId);
    }
    return next;
  }

  async cancelModel(runId: string, modelId: string, reason = "Canceled by user") {
    const next = await updateBenchmarkRun(runId, (run) => cancelModelState(run, modelId, reason));
    if (!next) throw new Error("Run not found");
    publishRunSnapshot(next);
    this.abortModel(runId, modelId, reason);
    if (!this.running.has(runId) && !isTerminalRunStatus(next.status) && next.status !== "awaiting_human_critique") {
      this.enqueue(runId);
    }
    return next;
  }

  private async drain() {
    while (this.queue.length > 0) {
      const runId = this.queue.shift();
      if (!runId || this.running.has(runId)) continue;

      this.running.add(runId);
      try {
        await executeBenchmarkRun(runId, {
          createAbortController: (key) => this.registerAbortController(runId, key),
          releaseAbortController: (key) => this.releaseAbortController(runId, key),
          isCancellationRequested: async () => {
            const run = await loadBenchmarkRun(runId);
            return Boolean(run?.cancellation.requested);
          },
        });
      } finally {
        this.running.delete(runId);
        this.abortControllers.delete(runId);
      }
    }
  }

  private registerAbortController(runId: string, key: string): AbortController {
    const controllers = this.abortControllers.get(runId) ?? new Map<string, AbortController>();
    const controller = new AbortController();
    controllers.set(key, controller);
    this.abortControllers.set(runId, controllers);
    return controller;
  }

  private releaseAbortController(runId: string, key: string) {
    const controllers = this.abortControllers.get(runId);
    controllers?.delete(key);
    if (controllers && controllers.size === 0) {
      this.abortControllers.delete(runId);
    }
  }

  private abortRun(runId: string, reason: string) {
    const controllers = this.abortControllers.get(runId);
    if (!controllers) return;
    for (const controller of controllers.values()) {
      controller.abort(new Error(reason));
    }
  }

  private abortModel(runId: string, modelId: string, reason: string) {
    const controllers = this.abortControllers.get(runId);
    if (!controllers) return;
    for (const [key, controller] of controllers.entries()) {
      if (key.endsWith(`:${modelId}`)) {
        controller.abort(new Error(reason));
      }
    }
  }
}

function createActionId() {
  return `ctrl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isTerminalRunStatus(status: BenchmarkRun["status"]) {
  return ["complete", "canceled"].includes(status);
}

function appendHistory(
  run: BenchmarkRun,
  scope: "run" | "model",
  action: "pause" | "resume" | "cancel" | "restart" | "retry" | "proceed",
  modelId?: string,
  reason?: string
): BenchmarkRun {
  const timestamp = new Date().toISOString();
  const nextModelControls = { ...run.controls.modelControls };

  if (modelId && nextModelControls[modelId]) {
    nextModelControls[modelId] = {
      ...nextModelControls[modelId],
      lastAction: action,
      lastActionAt: timestamp,
      note: reason,
    };
  }

  return {
    ...run,
    controls: {
      ...run.controls,
      modelControls: nextModelControls,
      lastRunAction: scope === "run" ? action : run.controls.lastRunAction,
      lastRunActionAt: scope === "run" ? timestamp : run.controls.lastRunActionAt,
      history: [
        ...run.controls.history,
        {
          id: createActionId(),
          scope,
          action,
          timestamp,
          actor: "user",
          stage: run.checkpoint.stage,
          modelId,
          reason,
        },
      ],
    },
  };
}

function resetCurrentStageStatesForResume(run: BenchmarkRun): BenchmarkRun["modelStates"] {
  const next = { ...run.modelStates };
  for (const [modelId, state] of Object.entries(next)) {
    if (state.stage !== run.checkpoint.stage) continue;
    if (state.status === "complete" || state.status === "canceled") continue;
    next[modelId] = {
      ...state,
      status: "queued",
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
    };
  }
  return next;
}

function getCheckpointEligibleModelIds(run: BenchmarkRun, stage: BenchmarkRun["checkpoint"]["stage"]): string[] {
  switch (stage) {
    case "generate":
      return run.selectedModels.map((model) => model.id);
    case "critique":
    case "human_critique":
    case "revise":
      return run.ideas
        .map((idea) => idea.modelId)
        .filter((modelId, index, values) => values.indexOf(modelId) === index)
        .filter((modelId) => run.modelStates[modelId]?.status !== "canceled");
    case "vote":
    case "complete":
      return run.revisedIdeas
        .map((idea) => idea.modelId)
        .filter((modelId, index, values) => values.indexOf(modelId) === index)
        .filter((modelId) => run.modelStates[modelId]?.status !== "canceled");
    default:
      return [];
  }
}

function getCheckpointCompletedModelIds(run: BenchmarkRun, stage: BenchmarkRun["checkpoint"]["stage"]): string[] {
  switch (stage) {
    case "generate":
      return run.ideas.map((idea) => idea.modelId);
    case "critique":
    case "human_critique":
      return run.critiqueVotes.map((vote) => vote.fromModelId);
    case "revise":
      return run.revisedIdeas.map((idea) => idea.modelId);
    case "vote":
    case "complete":
      return run.finalRankings.map((ranking) => ranking.judgeModelId);
    default:
      return [];
  }
}

function reconcileRunCheckpointState(run: BenchmarkRun): BenchmarkRun {
  const stage = run.checkpoint.stage;
  if (stage === "human_critique") {
    return {
      ...run,
      checkpoint: createCheckpointForStage(
        "human_critique",
        getCheckpointCompletedModelIds(run, "critique"),
        run.checkpoint.readyForRevisionModelIds.length > 0
          ? run.checkpoint.readyForRevisionModelIds
          : getCheckpointEligibleModelIds(run, "human_critique")
      ),
    };
  }

  const eligibleIds = new Set(getCheckpointEligibleModelIds(run, stage));
  const completedIds = new Set(getCheckpointCompletedModelIds(run, stage));
  const nextStates = { ...run.modelStates };

  for (const [modelId, state] of Object.entries(nextStates)) {
    if (state.status === "canceled") continue;
    if (!eligibleIds.has(modelId)) continue;

    if (completedIds.has(modelId)) {
      nextStates[modelId] = {
        ...state,
        stage,
        status: "complete",
        error: undefined,
        startedAt: state.startedAt,
        completedAt: state.completedAt ?? new Date().toISOString(),
      };
      continue;
    }

    nextStates[modelId] = {
      ...state,
      stage,
      status: state.status === "paused" ? "paused" : "queued",
      error: undefined,
      startedAt: undefined,
      completedAt: undefined,
    };
  }

  return {
    ...run,
    modelStates: nextStates,
    checkpoint: createCheckpointForStage(
      stage,
      Array.from(completedIds),
      run.checkpoint.readyForRevisionModelIds
    ),
  };
}

function prepareRunForResume(run: BenchmarkRun): BenchmarkRun {
  const reconciled = reconcileRunCheckpointState(run);
  const next = appendHistory(reconciled, "run", "resume", undefined, `Queued to resume ${reconciled.checkpoint.stage} from checkpoint`);
  const modelControls = { ...next.controls.modelControls };

  for (const [modelId, control] of Object.entries(modelControls)) {
    modelControls[modelId] = {
      ...control,
      isPaused: false,
      note: undefined,
    };
  }

  return {
    ...next,
    status: "queued",
    error: undefined,
    currentStep: `Queued to resume ${next.checkpoint.stage} from checkpoint`,
    cancellation: {
      requested: false,
    },
    failedModels: next.failedModels.filter((modelId) => {
      const state = next.modelStates[modelId];
      return state?.status === "failed" && state.stage !== next.checkpoint.stage;
    }),
    failures: next.failures.filter((failure) => failure.stage !== next.checkpoint.stage || !failure.modelId || next.modelStates[failure.modelId]?.status === "complete"),
    modelStates: resetCurrentStageStatesForResume(next),
    controls: {
      ...next.controls,
      modelControls,
    },
  };
}

function markRunPaused(run: BenchmarkRun, reason: string): BenchmarkRun {
  const next = appendHistory(run, "run", "pause", undefined, reason);
  const modelStates = { ...next.modelStates };
  for (const [modelId, state] of Object.entries(modelStates)) {
    if (state.stage !== next.checkpoint.stage || state.status !== "running") continue;
    modelStates[modelId] = {
      ...state,
      status: "queued",
      startedAt: undefined,
    };
  }

  return {
    ...next,
    status: "paused",
    currentStep: "Run paused",
    modelStates,
  };
}

function markRunCanceled(run: BenchmarkRun, reason: string): BenchmarkRun {
  const next = appendHistory(run, "run", "cancel", undefined, reason);
  const timestamp = new Date().toISOString();
  const modelStates = { ...next.modelStates };
  const modelControls = { ...next.controls.modelControls };

  for (const [modelId, state] of Object.entries(modelStates)) {
    if (state.status === "complete") continue;
    modelStates[modelId] = {
      ...state,
      stage: next.checkpoint.stage,
      status: "canceled",
      completedAt: timestamp,
      error: undefined,
    };
    if (modelControls[modelId]) {
      modelControls[modelId] = {
        ...modelControls[modelId],
        isCanceled: true,
        isPaused: false,
        lastAction: "cancel",
        lastActionAt: timestamp,
        note: reason,
      };
    }
  }

  return {
    ...next,
    status: "canceled",
    currentStep: "Run canceled",
    cancellation: {
      requested: true,
      requestedAt: next.cancellation.requestedAt ?? timestamp,
      reason,
    },
    modelStates,
    controls: {
      ...next.controls,
      modelControls,
    },
  };
}

function ensureModelExists(run: BenchmarkRun, modelId: string) {
  if (!run.modelStates[modelId]) {
    throw new Error(`Model not found in run: ${modelId}`);
  }
}

function markModelPaused(run: BenchmarkRun, modelId: string, reason: string): BenchmarkRun {
  ensureModelExists(run, modelId);
  const next = appendHistory(run, "model", "pause", modelId, reason);
  const currentState = next.modelStates[modelId];
  const timestamp = new Date().toISOString();

  return {
    ...next,
    modelStates: {
      ...next.modelStates,
      [modelId]: {
        ...currentState,
        stage: next.checkpoint.stage,
        status: "paused",
        startedAt: undefined,
        completedAt: undefined,
        error: undefined,
      },
    },
    controls: {
      ...next.controls,
      modelControls: {
        ...next.controls.modelControls,
        [modelId]: {
          ...next.controls.modelControls[modelId],
          isPaused: true,
          lastAction: "pause",
          lastActionAt: timestamp,
          note: reason,
        },
      },
    },
  };
}

function resumeModelState(run: BenchmarkRun, modelId: string): BenchmarkRun {
  ensureModelExists(run, modelId);
  const next = appendHistory(run, "model", "resume", modelId, "Queued to resume current stage");
  const timestamp = new Date().toISOString();
  return {
    ...next,
    status: next.status === "paused" ? "queued" : next.status,
    currentStep: next.status === "paused" ? "Queued to resume current stage" : next.currentStep,
    error: next.status === "paused" ? undefined : next.error,
    modelStates: {
      ...next.modelStates,
      [modelId]: {
        ...next.modelStates[modelId],
        stage: next.checkpoint.stage,
        status: "queued",
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
      },
    },
    controls: {
      ...next.controls,
      modelControls: {
        ...next.controls.modelControls,
        [modelId]: {
          ...next.controls.modelControls[modelId],
          isPaused: false,
          isCanceled: false,
          lastAction: "resume",
          lastActionAt: timestamp,
          note: undefined,
        },
      },
    },
  };
}

function clearStageArtifacts(run: BenchmarkRun, modelId: string, stage: BenchmarkRun["checkpoint"]["stage"]): BenchmarkRun {
  switch (stage) {
    case "generate":
      return {
        ...run,
        ideas: run.ideas.filter((idea) => idea.modelId !== modelId),
        web: {
          ...run.web,
          toolCalls: run.web.toolCalls.filter((entry) => !(entry.stage === "generate" && entry.modelId === modelId)),
          retrievedSources: run.web.retrievedSources.filter((entry) => !(entry.stage === "generate" && entry.modelId === modelId)),
          usage: run.web.usage.filter((entry) => !(entry.stage === "generate" && entry.modelId === modelId)),
        },
        reasoning: {
          ...run.reasoning,
          details: run.reasoning.details.filter((entry) => !(entry.stage === "generate" && entry.modelId === modelId)),
        },
      };
    case "critique":
      return {
        ...run,
        critiqueVotes: run.critiqueVotes.filter((vote) => vote.fromModelId !== modelId),
      };
    case "revise":
      return {
        ...run,
        revisedIdeas: run.revisedIdeas.filter((idea) => idea.modelId !== modelId),
        web: {
          ...run.web,
          toolCalls: run.web.toolCalls.filter((entry) => !(entry.stage === "revise" && entry.modelId === modelId)),
          retrievedSources: run.web.retrievedSources.filter((entry) => !(entry.stage === "revise" && entry.modelId === modelId)),
          usage: run.web.usage.filter((entry) => !(entry.stage === "revise" && entry.modelId === modelId)),
        },
        reasoning: {
          ...run.reasoning,
          details: run.reasoning.details.filter((entry) => !(entry.stage === "revise" && entry.modelId === modelId)),
        },
      };
    case "vote":
      return {
        ...run,
        finalRankings: run.finalRankings.filter((entry) => entry.judgeModelId !== modelId),
      };
    default:
      return run;
  }
}

function retryModelStage(run: BenchmarkRun, modelId: string): BenchmarkRun {
  ensureModelExists(run, modelId);
  const currentStage = run.checkpoint.stage;
  const next = appendHistory(clearStageArtifacts(run, modelId, currentStage), "model", "retry", modelId, "Queued to retry current stage");
  const timestamp = new Date().toISOString();

  return {
    ...next,
    status: ["paused", "error", "dead_lettered", "partial"].includes(next.status) ? "queued" : next.status,
    currentStep: ["paused", "error", "dead_lettered", "partial"].includes(next.status)
      ? "Queued to retry current stage"
      : next.currentStep,
    error: ["paused", "error", "dead_lettered", "partial"].includes(next.status) ? undefined : next.error,
    failedModels: next.failedModels.filter((entry) => entry !== modelId),
    failures: next.failures.filter((failure) => !(failure.modelId === modelId && failure.stage === currentStage)),
    checkpoint: {
      ...next.checkpoint,
      completedModelIds: next.checkpoint.completedModelIds.filter((entry) => entry !== modelId),
      updatedAt: timestamp,
    },
    modelStates: {
      ...next.modelStates,
      [modelId]: {
        ...next.modelStates[modelId],
        stage: currentStage,
        status: "retrying",
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
      },
    },
    controls: {
      ...next.controls,
      modelControls: {
        ...next.controls.modelControls,
        [modelId]: {
          ...next.controls.modelControls[modelId],
          isPaused: false,
          isCanceled: false,
          lastAction: "retry",
          lastActionAt: timestamp,
          note: "Queued to retry current stage",
        },
      },
    },
  };
}

function cancelModelState(run: BenchmarkRun, modelId: string, reason: string): BenchmarkRun {
  ensureModelExists(run, modelId);
  const next = appendHistory(run, "model", "cancel", modelId, reason);
  const timestamp = new Date().toISOString();

  return {
    ...next,
    failedModels: next.failedModels.filter((entry) => entry !== modelId),
    modelStates: {
      ...next.modelStates,
      [modelId]: {
        ...next.modelStates[modelId],
        stage: next.checkpoint.stage,
        status: "canceled",
        error: undefined,
        completedAt: timestamp,
      },
    },
    controls: {
      ...next.controls,
      modelControls: {
        ...next.controls.modelControls,
        [modelId]: {
          ...next.controls.modelControls[modelId],
          isPaused: false,
          isCanceled: true,
          lastAction: "cancel",
          lastActionAt: timestamp,
          note: reason,
        },
      },
    },
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __novelBenchRunScheduler: RunScheduler | undefined;
}

export function getRunScheduler(): RunScheduler {
  if (!globalThis.__novelBenchRunScheduler) {
    globalThis.__novelBenchRunScheduler = new RunScheduler();
    void globalThis.__novelBenchRunScheduler.bootstrap();
  }
  return globalThis.__novelBenchRunScheduler;
}

export async function createAndQueueRun(input: CreateBenchmarkRunInput) {
  const run = await getBenchmarkRepository().createRun(input);
  getRunEventBus().setSnapshot(run);
  getRunScheduler().enqueue(run.id);
  return run;
}

export async function proceedBenchmarkRun(runId: string) {
  const run = await getRunScheduler().proceed(runId);
  return run;
}

export async function cancelBenchmarkRun(runId: string, reason?: string) {
  await getRunScheduler().cancel(runId, reason);
  return loadBenchmarkRun(runId);
}

export async function pauseBenchmarkRun(runId: string, reason?: string) {
  return getRunScheduler().pause(runId, reason);
}

export async function resumeBenchmarkRun(runId: string) {
  return getRunScheduler().resume(runId);
}

export async function restartBenchmarkRun(runId: string) {
  return getRunScheduler().restart(runId);
}

export async function retryBenchmarkRun(runId: string) {
  return getRunScheduler().retry(runId);
}

export async function pauseModelInRun(runId: string, modelId: string, reason?: string) {
  return getRunScheduler().pauseModel(runId, modelId, reason);
}

export async function resumeModelInRun(runId: string, modelId: string) {
  return getRunScheduler().resumeModel(runId, modelId);
}

export async function retryModelInRun(runId: string, modelId: string) {
  return getRunScheduler().retryModel(runId, modelId);
}

export async function cancelModelInRun(runId: string, modelId: string, reason?: string) {
  return getRunScheduler().cancelModel(runId, modelId, reason);
}

export async function addHumanCritiquesToRun(
  runId: string,
  critiques: Omit<HumanCritiqueEntry, "id" | "timestamp">[]
) {
  return getRunScheduler().addHumanCritiques(runId, critiques);
}

export async function ensureSchedulerBootstrapped() {
  await getRunScheduler().bootstrap();
}

export async function getCurrentRunOrThrow(runId: string): Promise<BenchmarkRun> {
  const run = await loadBenchmarkRun(runId);
  if (!run) throw new Error("Run not found");
  return run;
}
