import { ConvexError, v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { requireProjectAccess } from "./lib/auth";

async function buildProjectSummary(ctx: any, projectId: any) {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new ConvexError("Project not found");
  }

  const [budgets, recentRuns] = await Promise.all([
    ctx.db
      .query("usageBudgets")
      .withIndex("by_org_project_period", (q: any) =>
        q.eq("organizationId", project.organizationId).eq("projectId", projectId),
      )
      .collect(),
    ctx.db
      .query("runs")
      .withIndex("by_project_and_created_at", (q: any) => q.eq("projectId", projectId))
      .order("desc")
      .take(20),
  ]);

  let settledCostUsd = 0;
  for await (const usage of ctx.db
    .query("projectUsageDaily")
    .withIndex("by_project_and_day", (q: any) => q.eq("projectId", projectId))) {
    settledCostUsd += usage.settledCostUsd;
  }

  let runCount = 0;
  let completedRuns = 0;
  let partialRuns = 0;
  let failedRuns = 0;
  for await (const run of ctx.db
    .query("runs")
    .withIndex("by_project_and_created_at", (q: any) => q.eq("projectId", projectId))) {
    runCount += 1;
    if (run.status === "complete") {
      completedRuns += 1;
    } else if (run.status === "partial") {
      partialRuns += 1;
    } else if (run.status === "dead_lettered" || run.status === "error") {
      failedRuns += 1;
    }
  }

  return {
    project: {
      id: project._id,
      name: project.name,
      visibility: project.visibility,
    },
    totals: {
      runCount,
      completedRuns,
      partialRuns,
      failedRuns,
      settledCostUsd,
    },
    recentRuns: recentRuns.map((run: any) => ({
      id: run._id,
      categoryId: run.categoryId,
      promptExcerpt: run.promptExcerpt,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      participantCount: run.participantCount,
    })),
    budgets: budgets.map((budget: any) => ({
      period: budget.period,
      periodKey: budget.periodKey,
      reservedUsd: budget.reservedUsd,
      settledUsd: budget.settledUsd,
    })),
  };
}

export const getProjectSummary = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId, "viewer");
    return await buildProjectSummary(ctx, args.projectId);
  },
});

export const getProjectSummaryInternal = internalQuery({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.any(),
  handler: async (ctx, args) => await buildProjectSummary(ctx, args.projectId),
});
