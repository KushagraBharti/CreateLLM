"use client";

import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import Button from "@/components/ui/Button";

export default function AccountPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const viewer = useQuery(api.app.currentViewer, isAuthenticated ? {} : "skip");
  const providerStatus = useQuery(
    api.settings.getProviderStatus,
    isAuthenticated ? {} : "skip",
  );
  const saveProviderKeys = useAction(api.settingsActions.saveProviderKeys);
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [exaApiKey, setExaApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(() => {
      void saveProviderKeys({
        openrouterApiKey: openrouterApiKey.trim() || undefined,
        exaApiKey: exaApiKey.trim() || undefined,
      })
        .then(() => {
          setOpenrouterApiKey("");
          setExaApiKey("");
          setMessage("Keys saved.");
        })
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : "Failed to save keys.");
        });
    });
  }

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-6 py-14 text-text-muted">Loading account...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="max-w-3xl border-t border-border pt-10">
          <p className="label mb-5">Account</p>
          <h1 className="font-display text-[clamp(3rem,6vw,5rem)] leading-[0.95] text-text-primary">
            Sign in to
            <br />
            unlock your station.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-secondary">
            Connect GitHub to run benchmarks, store provider keys, and keep
            your operator profile active inside the arena.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Button type="button" size="lg" onClick={() => void signIn("github", { redirectTo: "/account" })}>
              Sign in with GitHub
            </Button>
            <Link
              href="/leaderboard"
              className="text-base text-text-muted transition-colors hover:text-text-primary"
            >
              Stay public, view rankings →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const operatorName = viewer?.user.name ?? "GitHub Operator";
  const operatorEmail = viewer?.user.email ?? "No email available";
  const openrouterConfigured = providerStatus?.openrouterConfigured ?? false;
  const exaConfigured = providerStatus?.exaConfigured ?? false;

  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="border-t border-border pt-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="label mb-5">Account</p>
            <h1 className="font-display text-[clamp(3rem,6vw,5.25rem)] leading-[0.94] text-text-primary">
              {operatorName}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-text-secondary">
              GitHub operator profile attached to the live NovelBench arena.
            </p>
            <p className="mt-2 text-sm uppercase tracking-[0.24em] text-text-muted">
              {operatorEmail}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/arena"
              className="text-base text-text-muted transition-colors hover:text-text-primary"
            >
              Enter arena →
            </Link>
            <Button type="button" variant="ghost" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-px border border-border bg-border lg:grid-cols-[0.92fr_1.08fr]">
        <section className="bg-bg-deep px-6 py-8 sm:px-8">
          <div className="mb-8 flex items-center justify-between">
            <p className="label">Provider Status</p>
            <span className="font-mono text-xs uppercase tracking-[0.24em] text-text-muted">
              Public Arena
            </span>
          </div>

          <div className="space-y-6">
            <div className="border-b border-border pb-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-2xl text-text-primary">OpenRouter</span>
                <span
                  className={openrouterConfigured ? "text-accent" : "text-text-muted"}
                >
                  {openrouterConfigured ? "Ready" : "Missing"}
                </span>
              </div>
              <p className="text-base leading-relaxed text-text-secondary">
                Used for all model generation, critique, revision, and voting.
              </p>
            </div>

            <div className="border-b border-border pb-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-display text-2xl text-text-primary">Exa</span>
                <span className={exaConfigured ? "text-accent" : "text-text-muted"}>
                  {exaConfigured ? "Ready" : "Missing"}
                </span>
              </div>
              <p className="text-base leading-relaxed text-text-secondary">
                Powers optional web research during generation and revision.
              </p>
            </div>

            <div className="pt-1 text-sm leading-relaxed text-text-muted">
              Everything ships publicly by default right now. There are no
              private project controls on the surface anymore.
            </div>
          </div>
        </section>

        <section className="bg-bg-surface px-6 py-8 sm:px-8">
          <div className="mb-8">
            <p className="label mb-4">Bring Your Own Keys</p>
            <p className="max-w-2xl text-base leading-relaxed text-text-secondary">
              Keys are encrypted before storage and only decrypted inside
              server-side Convex actions during execution.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-px border border-border bg-border">
              <label className="bg-bg-deep px-5 py-5">
                <span className="label mb-2 block">OpenRouter API Key</span>
                <input
                  type="password"
                  value={openrouterApiKey}
                  onChange={(event) => setOpenrouterApiKey(event.target.value)}
                  className="w-full border-0 bg-transparent px-0 py-0 text-lg text-text-primary outline-none placeholder:text-text-muted/45"
                  placeholder="sk-or-v1-..."
                />
              </label>
              <label className="bg-bg-deep px-5 py-5">
                <span className="label mb-2 block">Exa API Key</span>
                <input
                  type="password"
                  value={exaApiKey}
                  onChange={(event) => setExaApiKey(event.target.value)}
                  className="w-full border-0 bg-transparent px-0 py-0 text-lg text-text-primary outline-none placeholder:text-text-muted/45"
                  placeholder="exa_..."
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Keys"}
              </Button>
              <span className="text-sm text-text-muted">
                Leave a field blank to keep the stored value unchanged.
              </span>
            </div>

            {message ? (
              <p className="text-sm uppercase tracking-[0.18em] text-text-muted">
                {message}
              </p>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
