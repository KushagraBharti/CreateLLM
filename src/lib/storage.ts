import { promises as fs } from "fs";
import path from "path";
import {
  BenchmarkRun,
  BenchmarkRunSummary,
  CircuitBreakerState,
  CreateBenchmarkRunInput,
  ModelCatalogEntry,
  ModelRunState,
  RunCheckpoint,
  RunCheckpointStage,
} from "@/types";
import { MODEL_SELECTION_LIMITS, getDefaultModels, resolveSelectedModels } from "./models";

const DATA_DIR = path.join(process.cwd(), "data");
const RUNS_DIR = path.join(DATA_DIR, "runs");

export interface BenchmarkRepository {
  createRun(input: CreateBenchmarkRunInput): Promise<BenchmarkRun>;
  saveRun(run: BenchmarkRun): Promise<void>;
  loadRun(id: string): Promise<BenchmarkRun | null>;
  updateRun(id: string, updater: (run: BenchmarkRun) => BenchmarkRun): Promise<BenchmarkRun | null>;
  listRuns(): Promise<BenchmarkRun[]>;
  listSummaries(): Promise<BenchmarkRunSummary[]>;
  listRunsByStatus(statuses: BenchmarkRun["status"][]): Promise<BenchmarkRun[]>;
}

async function ensureDataDir() {
  await fs.mkdir(RUNS_DIR, { recursive: true });
}

function generateId(): string {
  return `bench_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildModelStates(models: ModelCatalogEntry[]): Record<string, ModelRunState> {
  return Object.fromEntries(
    models.map((model) => [
      model.id,
      {
        modelId: model.id,
        status: "queued",
        stage: "generate",
      },
    ])
  );
}

function createCheckpoint(): RunCheckpoint {
  return {
    stage: "generate",
    completedModelIds: [],
    readyForRevisionModelIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function createCircuitBreakerState(): CircuitBreakerState {
  return {
    status: "closed",
    failureCount: 0,
  };
}

function minimumSuccessfulModels(participantCount: number): number {
  return Math.max(MODEL_SELECTION_LIMITS.min, Math.min(participantCount, Math.ceil(participantCount / 2)));
}

function toSummary(run: BenchmarkRun): BenchmarkRunSummary {
  const completedModelCount = Object.values(run.modelStates).filter(
    (state) => state.status === "complete"
  ).length;
  return {
    id: run.id,
    categoryId: run.categoryId,
    prompt: run.prompt,
    timestamp: run.timestamp,
    updatedAt: run.updatedAt,
    status: run.status,
    modelCount: run.selectedModels.length,
    completedModelCount,
    failedModelCount: run.failedModels.length,
  };
}

async function runPath(id: string): Promise<string> {
  await ensureDataDir();
  return path.join(RUNS_DIR, `${id}.json`);
}

class FileBenchmarkRepository implements BenchmarkRepository {
  async createRun(input: CreateBenchmarkRunInput): Promise<BenchmarkRun> {
    const selectedModels = resolveSelectedModels(
      input.selectedModelIds.length > 0 ? input.selectedModelIds : getDefaultModels().map((model) => model.id),
      input.customModelIds
    );

    if (selectedModels.length < MODEL_SELECTION_LIMITS.min) {
      throw new Error(`Select at least ${MODEL_SELECTION_LIMITS.min} models`);
    }

    if (selectedModels.length > MODEL_SELECTION_LIMITS.max) {
      throw new Error(`Select at most ${MODEL_SELECTION_LIMITS.max} models`);
    }

    const now = new Date().toISOString();
    const run: BenchmarkRun = {
      id: generateId(),
      categoryId: input.categoryId,
      prompt: input.prompt,
      selectedModels,
      timestamp: now,
      updatedAt: now,
      status: "queued",
      currentStep: "Queued for execution",
      exposureMode: "public_full",
      ideas: [],
      critiqueVotes: [],
      humanCritiques: [],
      revisedIdeas: [],
      finalRankings: [],
      failedModels: [],
      modelStates: buildModelStates(selectedModels),
      failures: [],
      checkpoint: createCheckpoint(),
      cancellation: { requested: false },
      circuitBreaker: createCircuitBreakerState(),
      metadata: {
        participantCount: selectedModels.length,
        minimumSuccessfulModels: minimumSuccessfulModels(selectedModels.length),
      },
    };

    await this.saveRun(run);
    return run;
  }

  async saveRun(run: BenchmarkRun): Promise<void> {
    const filePath = await runPath(run.id);
    const payload = {
      ...run,
      updatedAt: new Date().toISOString(),
      checkpoint: {
        ...run.checkpoint,
        updatedAt: new Date().toISOString(),
      },
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
  }

  async loadRun(id: string): Promise<BenchmarkRun | null> {
    try {
      const filePath = await runPath(id);
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as BenchmarkRun;
    } catch {
      return null;
    }
  }

  async updateRun(
    id: string,
    updater: (run: BenchmarkRun) => BenchmarkRun
  ): Promise<BenchmarkRun | null> {
    const run = await this.loadRun(id);
    if (!run) return null;
    const next = updater(run);
    await this.saveRun(next);
    return next;
  }

  async listRuns(): Promise<BenchmarkRun[]> {
    await ensureDataDir();
    try {
      const files = await fs.readdir(RUNS_DIR);
      const runs = await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map(async (file) => {
            const content = await fs.readFile(path.join(RUNS_DIR, file), "utf-8");
            return JSON.parse(content) as BenchmarkRun;
          })
      );
      runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return runs;
    } catch {
      return [];
    }
  }

  async listSummaries(): Promise<BenchmarkRunSummary[]> {
    const runs = await this.listRuns();
    return runs.map(toSummary);
  }

  async listRunsByStatus(statuses: BenchmarkRun["status"][]): Promise<BenchmarkRun[]> {
    const runs = await this.listRuns();
    return runs.filter((run) => statuses.includes(run.status));
  }
}

let repositorySingleton: BenchmarkRepository | null = null;

export function getBenchmarkRepository(): BenchmarkRepository {
  if (!repositorySingleton) {
    repositorySingleton = new FileBenchmarkRepository();
  }
  return repositorySingleton;
}

export async function saveBenchmarkRun(run: BenchmarkRun): Promise<void> {
  await getBenchmarkRepository().saveRun(run);
}

export async function loadBenchmarkRun(id: string): Promise<BenchmarkRun | null> {
  return getBenchmarkRepository().loadRun(id);
}

export async function listBenchmarkRuns(): Promise<BenchmarkRun[]> {
  return getBenchmarkRepository().listRuns();
}

export async function listBenchmarkRunSummaries(): Promise<BenchmarkRunSummary[]> {
  return getBenchmarkRepository().listSummaries();
}

export async function updateBenchmarkRun(
  id: string,
  updater: (run: BenchmarkRun) => BenchmarkRun
): Promise<BenchmarkRun | null> {
  return getBenchmarkRepository().updateRun(id, updater);
}

export function createCheckpointForStage(
  stage: RunCheckpointStage,
  completedModelIds: string[],
  readyForRevisionModelIds: string[] = []
): RunCheckpoint {
  return {
    stage,
    completedModelIds,
    readyForRevisionModelIds,
    updatedAt: new Date().toISOString(),
  };
}
