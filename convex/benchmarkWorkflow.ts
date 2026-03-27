import { v } from "convex/values";
import { internal } from "./_generated/api";
import { workflow } from "./workflow";
import { HUMAN_CRITIQUE_EVENT, RUN_RESUME_EVENT } from "./lib/constants";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeWinningModel(bundle: any) {
  const rankings = bundle.participants
    .filter((participant: any) => participant.finalRanking?.rankings?.length)
    .map((participant: any) => participant.finalRanking);

  const candidateIds = Array.from(
    new Set(
      rankings.flatMap((ranking: any) =>
        ranking.rankings.map((entry: any) => entry.modelId),
      ),
    ),
  ) as string[];
  if (candidateIds.length === 0) {
    return null;
  }

  let winnerId = "";
  let bestAverageRank = Number.POSITIVE_INFINITY;
  let bestAverageScore = Number.NEGATIVE_INFINITY;

  for (const modelId of candidateIds) {
    const allRanks = rankings.flatMap((ranking: any) =>
      ranking.rankings
        .filter((entry: any) => entry.modelId === modelId)
        .map((entry: any) => entry.rank),
    );
    const allScores = rankings.flatMap((ranking: any) =>
      ranking.rankings
        .filter((entry: any) => entry.modelId === modelId)
        .map((entry: any) => entry.score),
    );
    const averageRank = average(allRanks);
    const averageScore = average(allScores);
    if (
      averageRank < bestAverageRank ||
      (averageRank === bestAverageRank && averageScore > bestAverageScore)
    ) {
      winnerId = modelId;
      bestAverageRank = averageRank;
      bestAverageScore = averageScore;
    }
  }

  if (!winnerId) {
    return null;
  }
  const model = bundle.run.selectedModels.find((entry: any) => entry.id === winnerId);
  return {
    modelId: winnerId,
    modelName: model?.name ?? winnerId,
  };
}

async function maybeWaitWhilePaused(step: any, runId: string) {
  const bundle = await step.runQuery(internal.runs.getWorkflowBundleInternal, { runId: runId as never });
  if (!bundle.run.pauseRequested) {
    return bundle;
  }
  await step.awaitEvent({ name: RUN_RESUME_EVENT });
  return await step.runQuery(internal.runs.getWorkflowBundleInternal, { runId: runId as never });
}

async function failForLowQuorum(step: any, args: {
  runId: string;
  message: string;
  status: "partial" | "dead_lettered";
}) {
  await step.runMutation(internal.runs.finalizeRunOutcomeInternal, {
    runId: args.runId as never,
    status: args.status,
    currentStep: args.message,
    finalWinnerModelId: undefined,
    finalWinnerName: undefined,
    error: args.message,
  });
}

export const runBenchmarkWorkflow = workflow.define({
  args: {
    runId: v.id("runs"),
  },
  returns: v.null(),
  handler: async (step, args): Promise<null> => {
    try {
      let bundle = await step.runQuery(internal.runs.getWorkflowBundleInternal, { runId: args.runId });
      if (bundle.run.cancellationRequested || bundle.run.status === "canceled") {
        return null;
      }

      bundle = await maybeWaitWhilePaused(step, args.runId);

      const generateParticipants = bundle.participants.filter(
        (participant: any) => !participant.generatedIdea && participant.status !== "canceled",
      );
      await step.runMutation(internal.runs.updateRunForStageInternal, {
        runId: args.runId,
        stage: "generate",
        status: "generating",
        currentStep: `Generating ideas from ${generateParticipants.length} models...`,
        eligibleCount: generateParticipants.length,
        completedCount: 0,
        readyCount: 0,
        completedAt: undefined,
      });
      await Promise.all(
        generateParticipants.map((participant: any) =>
          step.runAction(internal.benchmarkActions.generateParticipant, {
            runId: args.runId,
            participantId: participant._id,
          }, { retry: true, name: `generate:${participant.modelId}` }),
        ),
      );

      bundle = await step.runQuery(internal.runs.getWorkflowBundleInternal, { runId: args.runId });
      let survivors = bundle.participants.filter(
        (participant: any) =>
          participant.generatedIdea && participant.status !== "failed" && participant.status !== "canceled",
      );
      if (survivors.length < bundle.run.minimumSuccessfulModels) {
        await failForLowQuorum(step, {
          runId: args.runId,
          message: "Too few models responded to continue.",
          status: survivors.length === 0 ? "dead_lettered" : "partial",
        });
        return null;
      }

      bundle = await maybeWaitWhilePaused(step, args.runId);
      if (bundle.run.cancellationRequested || bundle.run.status === "canceled") {
        return null;
      }

      await step.runMutation(internal.runs.updateRunForStageInternal, {
        runId: args.runId,
        stage: "critique",
        status: "critiquing",
        currentStep: `Models are critiquing and ranking ideas (${survivors.length} active)...`,
        eligibleCount: survivors.length,
        completedCount: 0,
        readyCount: 0,
        completedAt: undefined,
      });
      await Promise.all(
        survivors.map((participant: any) =>
          step.runAction(internal.benchmarkActions.critiqueParticipant, {
            runId: args.runId,
            participantId: participant._id,
          }, { retry: true, name: `critique:${participant.modelId}` }),
        ),
      );

      bundle = await step.runQuery(internal.runs.getWorkflowBundleInternal, { runId: args.runId });
      survivors = bundle.participants.filter(
        (participant: any) =>
          participant.generatedIdea &&
          participant.critiqueResult &&
          participant.status !== "failed" &&
          participant.status !== "canceled",
      );
      if (survivors.length < bundle.run.minimumSuccessfulModels) {
        await failForLowQuorum(step, {
          runId: args.runId,
          message: "Too few models remained after critique.",
          status: "partial",
        });
        return null;
      }

      await step.runMutation(internal.runs.updateRunForStageInternal, {
        runId: args.runId,
        stage: "human_critique",
        status: "awaiting_human_critique",
        currentStep: "Review critiques or proceed to revision",
        eligibleCount: survivors.length,
        completedCount: survivors.length,
        readyCount: survivors.length,
        completedAt: Date.now(),
      });
      await step.awaitEvent({ name: HUMAN_CRITIQUE_EVENT });

      bundle = await maybeWaitWhilePaused(step, args.runId);
      if (bundle.run.cancellationRequested || bundle.run.status === "canceled") {
        return null;
      }

      survivors = bundle.participants.filter(
        (participant: any) =>
          participant.generatedIdea &&
          participant.critiqueResult &&
          participant.status !== "failed" &&
          participant.status !== "canceled",
      );
      await step.runMutation(internal.runs.updateRunForStageInternal, {
        runId: args.runId,
        stage: "revise",
        status: "revising",
        currentStep: `Models are revising ideas (${survivors.length} active)...`,
        eligibleCount: survivors.length,
        completedCount: 0,
        readyCount: survivors.length,
        completedAt: undefined,
      });
      await Promise.all(
        survivors.map((participant: any) =>
          step.runAction(internal.benchmarkActions.reviseParticipant, {
            runId: args.runId,
            participantId: participant._id,
          }, { retry: true, name: `revise:${participant.modelId}` }),
        ),
      );

      bundle = await step.runQuery(internal.runs.getWorkflowBundleInternal, { runId: args.runId });
      survivors = bundle.participants.filter(
        (participant: any) =>
          participant.revisedIdea && participant.status !== "failed" && participant.status !== "canceled",
      );
      if (survivors.length < bundle.run.minimumSuccessfulModels) {
        await failForLowQuorum(step, {
          runId: args.runId,
          message: "Too few revised ideas remained for final voting.",
          status: "partial",
        });
        return null;
      }

      bundle = await maybeWaitWhilePaused(step, args.runId);
      if (bundle.run.cancellationRequested || bundle.run.status === "canceled") {
        return null;
      }

      await step.runMutation(internal.runs.updateRunForStageInternal, {
        runId: args.runId,
        stage: "vote",
        status: "voting",
        currentStep: `Final round of voting (${survivors.length} active)...`,
        eligibleCount: survivors.length,
        completedCount: 0,
        readyCount: survivors.length,
        completedAt: undefined,
      });
      await Promise.all(
        survivors.map((participant: any) =>
          step.runAction(internal.benchmarkActions.voteParticipant, {
            runId: args.runId,
            participantId: participant._id,
          }, { retry: true, name: `vote:${participant.modelId}` }),
        ),
      );

      bundle = await step.runQuery(internal.runs.getWorkflowBundleInternal, { runId: args.runId });
      const finalJudges = bundle.participants.filter(
        (participant: any) =>
          participant.finalRanking && participant.status !== "failed" && participant.status !== "canceled",
      );
      if (finalJudges.length < bundle.run.minimumSuccessfulModels) {
        await failForLowQuorum(step, {
          runId: args.runId,
          message: "Too few final votes were completed.",
          status: "partial",
        });
        return null;
      }

      const winningModel = computeWinningModel(bundle);
      await step.runMutation(internal.runs.finalizeRunOutcomeInternal, {
        runId: args.runId,
        status: "complete",
        currentStep: "Benchmark complete!",
        finalWinnerModelId: winningModel?.modelId,
        finalWinnerName: winningModel?.modelName,
        error: undefined,
      });
      await step.runAction(internal.leaderboards.rebuildSnapshotsInternal, {
        runId: args.runId,
      });

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Benchmark workflow failed";
      await step.runMutation(internal.runs.finalizeRunOutcomeInternal, {
        runId: args.runId,
        status: "dead_lettered",
        currentStep: message,
        finalWinnerModelId: undefined,
        finalWinnerName: undefined,
        error: message,
      });
      return null;
    }
  },
});
