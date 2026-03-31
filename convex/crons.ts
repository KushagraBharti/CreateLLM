import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "reconcile stale run concurrency",
  { hours: 1 },
  internal.runs.reconcileRunConcurrencyStateInternal,
  {},
);

export default crons;
