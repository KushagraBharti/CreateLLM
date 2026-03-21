import { WorkflowManager } from "@convex-dev/workflow";
import { Workpool } from "@convex-dev/workpool";
import { components } from "./_generated/api";

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 6,
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 1_000,
      base: 2,
    },
  },
});

export const exportsWorkpool = new Workpool(components.exportsWorkpool, {
  maxParallelism: 2,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1_000,
    base: 2,
  },
});
