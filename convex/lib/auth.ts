import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

export async function requireAuthUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Not authenticated");
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new ConvexError("Authenticated user record is missing");
  }
  return user;
}

export async function requireAuthenticatedIdentity(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Not authenticated");
  }
  return identity;
}

export async function requireProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  minimumRole: "viewer" | "editor" = "viewer",
) {
  const user = await requireAuthUser(ctx);
  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_and_user", (q) =>
      q.eq("projectId", projectId).eq("userId", user._id),
    )
    .unique();
  if (!membership) {
    throw new ConvexError("Unauthorized");
  }
  if (minimumRole === "editor" && membership.role !== "editor") {
    throw new ConvexError("Unauthorized");
  }
  return { user, membership };
}

export async function requireOrganizationAdminAccess(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const user = await requireAuthUser(ctx);
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization_and_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", user._id),
    )
    .unique();

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new ConvexError("Unauthorized");
  }

  return { user, membership };
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
