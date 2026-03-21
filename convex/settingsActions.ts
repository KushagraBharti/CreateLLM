"use node";

import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuthenticatedIdentity } from "./lib/auth";
import { encryptSecret } from "./lib/crypto";

export const saveProviderKeys = action({
  args: {
    openrouterApiKey: v.optional(v.string()),
    exaApiKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuthenticatedIdentity(ctx);

    const user = await ctx.runQuery(internal.settings.getCurrentUserInternal, {});
    const now = Date.now();
    let wroteKey = false;

    if (args.openrouterApiKey?.trim()) {
      const encrypted = encryptSecret(args.openrouterApiKey.trim());
      await ctx.runMutation(internal.settings.upsertVaultEntryInternal, {
        userId: user._id,
        provider: "openrouter",
        ...encrypted,
        now,
      });
      wroteKey = true;
    }

    if (args.exaApiKey?.trim()) {
      const encrypted = encryptSecret(args.exaApiKey.trim());
      await ctx.runMutation(internal.settings.upsertVaultEntryInternal, {
        userId: user._id,
        provider: "exa",
        ...encrypted,
        now,
      });
      wroteKey = true;
    }

    if (!wroteKey) {
      throw new ConvexError("At least one API key is required");
    }

    await ctx.runMutation(internal.settings.logAuditInternal, {
      actorUserId: user._id,
      action: "provider_keys.saved",
      organizationId: undefined,
      projectId: undefined,
      resourceType: "settings",
      resourceId: String(user._id),
      metadata: {
        openrouterConfigured: Boolean(args.openrouterApiKey?.trim()),
        exaConfigured: Boolean(args.exaApiKey?.trim()),
      },
      createdAt: now,
    });

    return null;
  },
});
