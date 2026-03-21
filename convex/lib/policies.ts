import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type PolicyCtx = Pick<QueryCtx | MutationCtx, "db">;

export async function getEffectiveProviderPolicy(
  ctx: PolicyCtx,
  organizationId: Id<"organizations">,
  projectId: Id<"projects">,
): Promise<Doc<"providerPolicies"> | null> {
  const projectPolicy = await ctx.db
    .query("providerPolicies")
    .withIndex("by_organization_and_project", (q) =>
      q.eq("organizationId", organizationId).eq("projectId", projectId),
    )
    .unique();

  if (projectPolicy) {
    return projectPolicy;
  }

  return await ctx.db
    .query("providerPolicies")
    .withIndex("by_organization_and_project", (q) =>
      q.eq("organizationId", organizationId).eq("projectId", undefined),
    )
    .unique();
}

export function isModelAllowedByPolicy(
  model: { id: string; openRouterId: string },
  allowedModelIds: string[] | undefined,
) {
  if (!allowedModelIds || allowedModelIds.length === 0) {
    return true;
  }

  return (
    allowedModelIds.includes(model.id) ||
    allowedModelIds.includes(model.openRouterId)
  );
}
