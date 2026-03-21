import type {
  BenchmarkControlState,
  BenchmarkRun,
  BenchmarkRunSummary,
  ControlActionRecord,
  CritiqueVoteResult,
  HumanCritiqueEntry,
  ModelControlState,
  ModelRunState,
  Ranking,
  RunCheckpoint,
  RunFailureRecord,
  StageWebTrace,
} from "@/types";
import { DEFAULT_WEB_SEARCH_CONFIG, mergeStageWebTraces } from "@/lib/benchmark-web";
import type { Doc, Id } from "../_generated/dataModel";

function toIso(timestamp?: number) {
  return new Date(timestamp ?? Date.now()).toISOString();
}

function uniqueModelIds(values: string[]) {
  return Array.from(new Set(values));
}

function completedModelIdsForStage(
  stage: BenchmarkRun["checkpoint"]["stage"],
  participants: Doc<"runParticipants">[],
) {
  switch (stage) {
    case "generate":
      return uniqueModelIds(
        participants.filter((participant) => participant.generatedIdea).map((participant) => participant.modelId),
      );
    case "critique":
    case "human_critique":
      return uniqueModelIds(
        participants.filter((participant) => participant.critiqueResult).map((participant) => participant.modelId),
      );
    case "revise":
      return uniqueModelIds(
        participants.filter((participant) => participant.revisedIdea).map((participant) => participant.modelId),
      );
    case "vote":
    case "complete":
      return uniqueModelIds(
        participants.filter((participant) => participant.finalRanking).map((participant) => participant.modelId),
      );
    default:
      return [];
  }
}

function controlHistoryFromEvents(events: Doc<"runEvents">[]): ControlActionRecord[] {
  return events
    .filter((event) =>
      [
        "run_paused",
        "run_resumed",
        "run_canceled",
        "run_restarted",
        "run_retried",
        "human_critique_proceeded",
      ].includes(event.kind),
    )
    .map((event) => {
      const kindToAction: Record<string, ControlActionRecord["action"]> = {
        run_paused: "pause",
        run_resumed: "resume",
        run_canceled: "cancel",
        run_restarted: "restart",
        run_retried: "retry",
        human_critique_proceeded: "proceed",
      };
      return {
        id: `${event._id}`,
        scope: event.participantModelId ? "model" : "run",
        action: kindToAction[event.kind] ?? "resume",
        timestamp: toIso(event.createdAt),
        actor: "user",
        stage: event.stage,
        modelId: event.participantModelId,
        reason: event.message,
      };
    });
}

function defaultModelControls(participants: Doc<"runParticipants">[]) {
  const controls: Record<string, ModelControlState> = {};
  for (const participant of participants) {
    controls[participant.modelId] = {
      modelId: participant.modelId,
      isPaused: participant.status === "paused",
      isCanceled: participant.status === "canceled",
    };
  }
  return controls;
}

function deriveCheckpoint(
  run: Doc<"runs">,
  participants: Doc<"runParticipants">[],
): RunCheckpoint {
  const completedModelIds = completedModelIdsForStage(run.checkpointStage, participants);
  const readyForRevisionModelIds =
    run.checkpointStage === "human_critique"
      ? uniqueModelIds(
          participants
            .filter(
              (participant) =>
                participant.critiqueResult &&
                participant.status !== "failed" &&
                participant.status !== "canceled",
            )
            .map((participant) => participant.modelId),
        )
      : [];

  return {
    stage: run.checkpointStage,
    completedModelIds,
    readyForRevisionModelIds,
    updatedAt: toIso(run.updatedAt),
  };
}

function deriveFailures(events: Doc<"runEvents">[]): RunFailureRecord[] {
  return events
    .filter((event) => event.kind === "model_failed" || event.kind === "run_failed")
    .map((event) => ({
      id: `${event._id}`,
      stage: event.stage,
      modelId: event.participantModelId,
      message: event.message,
      retryable: Boolean((event.payload as { retryable?: boolean } | undefined)?.retryable),
      timestamp: toIso(event.createdAt),
    }));
}

function mapIdeas(
  participants: Doc<"runParticipants">[],
  field: "generatedIdea" | "revisedIdea",
) {
  return participants
    .filter((participant) => participant[field])
    .sort((a, b) => a.order - b.order)
    .map((participant) => ({
      modelId: participant.modelId,
      content: participant[field] as BenchmarkRun["ideas"][number]["content"],
      raw: "",
      timestamp: toIso(participant.completedAt ?? participant._creationTime),
    }));
}

function mapCritiqueVotes(participants: Doc<"runParticipants">[]): CritiqueVoteResult[] {
  return participants
    .filter((participant) => participant.critiqueResult)
    .sort((a, b) => a.order - b.order)
    .map((participant) => participant.critiqueResult as CritiqueVoteResult);
}

function mapRankings(participants: Doc<"runParticipants">[]): Ranking[] {
  return participants
    .filter((participant) => participant.finalRanking)
    .sort((a, b) => a.order - b.order)
    .map((participant) => participant.finalRanking as Ranking);
}

function mapHumanCritiques(events: Doc<"runEvents">[]): HumanCritiqueEntry[] {
  return events
    .filter((event) => event.kind === "human_critique_submitted")
    .flatMap((event) => {
      const critiques = (event.payload as { critiques?: HumanCritiqueEntry[] } | undefined)?.critiques ?? [];
      return critiques.map((critique, index) => ({
        ...critique,
        id: critique.id || `${event._id}:${index}`,
        timestamp: critique.timestamp || toIso(event.createdAt),
      }));
    });
}

function mapWebState(events: Doc<"runEvents">[]) {
  const latestTraces = new Map<string, StageWebTrace>();

  for (const event of events) {
    if (event.kind !== "web_stage_trace" || !event.payload) {
      continue;
    }
    const payload = event.payload as StageWebTrace;
    const key = `${payload.modelId}:${payload.stage}`;
    latestTraces.set(key, payload);
  }

  return mergeStageWebTraces(Array.from(latestTraces.values()), DEFAULT_WEB_SEARCH_CONFIG);
}

export function canReadRun(
  run: Doc<"runs">,
  viewerUserId: Id<"users"> | null,
  projectMembership: Doc<"projectMembers"> | null,
  organizationMembership?: Doc<"organizationMembers"> | null,
) {
  if (run.visibility === "public" || run.visibility === "public_full") {
    return true;
  }
  if (!viewerUserId) {
    return false;
  }
  if (run.ownerUserId === viewerUserId) {
    return true;
  }
  if (projectMembership?.projectId === run.projectId) {
    return true;
  }
  if (run.visibility === "org_shared" && organizationMembership?.organizationId === run.organizationId) {
    return true;
  }
  return false;
}

export function runDocToSummary(run: Doc<"runs">): BenchmarkRunSummary {
  return {
    id: run._id,
    categoryId: run.categoryId,
    prompt: run.promptExcerpt,
    timestamp: toIso(run.createdAt),
    updatedAt: toIso(run.updatedAt),
    status: run.status,
    modelCount: run.participantCount,
    completedModelCount: run.completedParticipantCount,
    failedModelCount: run.failedParticipantCount,
  };
}

export function runDocsToBenchmarkRun(args: {
  run: Doc<"runs">;
  participants: Doc<"runParticipants">[];
  events: Doc<"runEvents">[];
}): BenchmarkRun {
  const ideas = mapIdeas(args.participants, "generatedIdea");
  const revisedIdeas = mapIdeas(args.participants, "revisedIdea");
  const critiqueVotes = mapCritiqueVotes(args.participants);
  const finalRankings = mapRankings(args.participants);
  const history = controlHistoryFromEvents(args.events);
  const modelControls = defaultModelControls(args.participants);
  const controls: BenchmarkControlState = {
    history,
    modelControls,
    lastRunAction: history.at(-1)?.scope === "run" ? history.at(-1)?.action : undefined,
    lastRunActionAt: history.at(-1)?.scope === "run" ? history.at(-1)?.timestamp : undefined,
  };

  const modelStates: Record<string, ModelRunState> = {};
  for (const participant of args.participants) {
    modelStates[participant.modelId] = {
      modelId: participant.modelId,
      stage: participant.stage,
      status: participant.status,
      startedAt: participant.startedAt ? toIso(participant.startedAt) : undefined,
      completedAt: participant.completedAt ? toIso(participant.completedAt) : undefined,
      error: participant.error,
    };
  }

  return {
    id: args.run._id,
    categoryId: args.run.categoryId,
    prompt: args.run.prompt,
    selectedModels: args.run.selectedModels as BenchmarkRun["selectedModels"],
    timestamp: toIso(args.run.createdAt),
    updatedAt: toIso(args.run.updatedAt),
    status: args.run.status,
    currentStep: args.run.currentStep,
    exposureMode: args.run.visibility,
    error: args.run.error,
    ideas,
    critiqueVotes,
    humanCritiques: mapHumanCritiques(args.events),
    revisedIdeas,
    finalRankings,
    failedModels: uniqueModelIds(
      args.participants
        .filter((participant) => participant.status === "failed")
        .map((participant) => participant.modelId),
    ),
    modelStates,
    failures: deriveFailures(args.events),
    checkpoint: deriveCheckpoint(args.run, args.participants),
    cancellation: {
      requested: args.run.cancellationRequested,
      requestedAt: args.run.cancellationRequested ? toIso(args.run.updatedAt) : undefined,
      reason:
        args.events.findLast((event) => event.kind === "run_canceled")?.message ??
        (args.run.cancellationRequested ? "Canceled by user" : undefined),
    },
    controls,
    circuitBreaker: {
      status: "closed",
      failureCount: 0,
    },
    web: mapWebState(args.events),
    reasoning: {
      details: [],
    },
    metadata: {
      participantCount: args.run.participantCount,
      minimumSuccessfulModels: args.run.minimumSuccessfulModels,
    },
  };
}

export function buildRunSearchText(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ").slice(0, 4000);
}

export function buildPromptExcerpt(prompt: string) {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  return normalized.length <= 240 ? normalized : `${normalized.slice(0, 237)}...`;
}

export function dayKeyFromTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
