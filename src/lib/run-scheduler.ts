import { executeBenchmarkRun } from "./engine";
import { getBenchmarkRepository, loadBenchmarkRun, updateBenchmarkRun } from "./storage";
import { getRunEventBus } from "./run-events";
import { BenchmarkRun, CreateBenchmarkRunInput, HumanCritiqueEntry } from "@/types";

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
      "generating",
      "critiquing",
      "revising",
      "voting",
      "error",
      "dead_lettered",
      "partial",
    ]);

    for (const run of resumable) {
      if (run.status === "error" || run.status === "dead_lettered" || run.status === "partial") {
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
    await updateBenchmarkRun(runId, (run) => ({
      ...run,
      cancellation: {
        requested: true,
        requestedAt: run.cancellation.requestedAt ?? new Date().toISOString(),
        reason,
      },
      currentStep: "Cancel requested",
    }));

    const controllers = this.abortControllers.get(runId);
    if (controllers) {
      for (const controller of controllers.values()) {
        controller.abort(new Error(reason));
      }
    }
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
    return loadBenchmarkRun(runId);
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
    getRunEventBus().setSnapshot(next);
    return next;
  }

  async retry(runId: string) {
    const run = await loadBenchmarkRun(runId);
    if (!run) throw new Error("Run not found");

    const retryStage =
      run.status === "awaiting_human_critique" ? "revise" : run.checkpoint.stage;

    await updateBenchmarkRun(runId, (current) => ({
      ...current,
      status: "queued",
      error: undefined,
      currentStep: "Queued for retry",
      checkpoint: {
        ...current.checkpoint,
        stage: retryStage,
        updatedAt: new Date().toISOString(),
      },
      cancellation: {
        requested: false,
      },
    }));

    this.enqueue(runId);
    return loadBenchmarkRun(runId);
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

export async function retryBenchmarkRun(runId: string) {
  return getRunScheduler().retry(runId);
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
