import { v } from "convex/values";

export const benchmarkStatusValidator = v.union(
  v.literal("queued"),
  v.literal("paused"),
  v.literal("generating"),
  v.literal("critiquing"),
  v.literal("awaiting_human_critique"),
  v.literal("revising"),
  v.literal("voting"),
  v.literal("complete"),
  v.literal("partial"),
  v.literal("canceled"),
  v.literal("dead_lettered"),
  v.literal("error"),
);

export const checkpointStageValidator = v.union(
  v.literal("generate"),
  v.literal("critique"),
  v.literal("human_critique"),
  v.literal("revise"),
  v.literal("vote"),
  v.literal("complete"),
);

export const exposureModeValidator = v.union(
  v.literal("private"),
  v.literal("org_shared"),
  v.literal("public"),
  v.literal("public_full"),
);

export const modelExecutionStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("paused"),
  v.literal("retrying"),
  v.literal("complete"),
  v.literal("failed"),
  v.literal("canceled"),
  v.literal("skipped"),
);

export const HUMAN_CRITIQUE_EVENT = "run-human-critique-proceed";
export const RUN_RESUME_EVENT = "run-resume";

export const DEFAULT_RUN_RESERVE_USD_PER_MODEL = 0.1;
export const USER_RUNS_PER_HOUR_LIMIT = 12;
export const USER_RUNS_PER_DAY_LIMIT = 100;
