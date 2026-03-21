"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";

export default function AuthControls() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const viewer = useQuery(api.app.currentViewer, isAuthenticated ? {} : "skip");
  const bootstrapViewer = useMutation(api.app.bootstrapViewer);
  const [isPending, startTransition] = useTransition();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !viewer || bootstrapped) {
      return;
    }
    if (viewer.defaultOrgId && viewer.defaultProjectId) {
      setBootstrapped(true);
      return;
    }
    startTransition(() => {
      void bootstrapViewer({}).then(() => {
        setBootstrapped(true);
      });
    });
  }, [bootstrapped, bootstrapViewer, isAuthenticated, viewer]);

  if (isLoading) {
    return <div className="text-sm text-text-muted">Auth...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void signIn("github", { redirectTo: pathname })}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Sign in with GitHub
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link
        href="/settings"
        className="text-text-muted hover:text-text-primary transition-colors"
      >
        {viewer?.providerStatus.openrouterConfigured ? "Settings" : "Setup Keys"}
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={isPending}
        className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
      >
        {viewer?.user.name ?? viewer?.user.email ?? "Sign out"}
      </button>
    </div>
  );
}
