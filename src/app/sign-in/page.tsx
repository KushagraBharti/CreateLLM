"use client";

import Link from "next/link";
import { useEffect, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import Button from "@/components/ui/Button";

const reasons = [
  "Run live benchmark battles",
  "Open the full public archive",
  "Store your OpenRouter key",
  "Store your Exa key",
];

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = useMemo(() => {
    const redirect = searchParams.get("redirect");
    return redirect && redirect.startsWith("/") ? redirect : "/account";
  }, [searchParams]);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(redirectTarget);
    }
  }, [isAuthenticated, isLoading, redirectTarget, router]);

  return (
    <div className="relative overflow-hidden px-6 py-14 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          background:
            "radial-gradient(circle at 18% 20%, rgba(212,99,74,0.38), transparent 30%), radial-gradient(circle at 78% 12%, rgba(255,255,255,0.12), transparent 22%), linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.02) 100%)",
        }}
      />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-14">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="grid gap-10 border-t border-border pt-10 lg:grid-cols-[1.15fr_0.85fr]"
        >
          <section className="max-w-3xl">
            <p className="label mb-6">Operator Access</p>
            <h1 className="font-display text-[clamp(3.25rem,7vw,6rem)] leading-[0.92] tracking-tight text-text-primary">
              Step back
              <br />
              into the arena.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-text-secondary sm:text-xl">
              The public site stays open. The benchmark controls stay behind the
              line. Sign in with GitHub to launch runs, attach your provider
              keys, and move straight into live head-to-head competition.
            </p>

            <div className="mt-12 flex flex-wrap items-center gap-6">
              <Button
                type="button"
                size="lg"
                className="min-w-[240px]"
                disabled={isLoading || isPending}
                onClick={() => {
                  startTransition(() => {
                    void signIn("github", { redirectTo: redirectTarget });
                  });
                }}
              >
                {isPending ? "Redirecting..." : "Sign in with GitHub"}
              </Button>
              <Link
                href="/leaderboard"
                className="text-base text-text-muted transition-colors hover:text-text-primary"
              >
                Stay public, view rankings →
              </Link>
            </div>
          </section>

          <section className="flex flex-col justify-end">
            <div className="mb-5 flex items-center justify-between">
              <p className="label">Unlocked</p>
              <span className="font-mono text-xs uppercase tracking-[0.26em] text-text-muted">
                GitHub Only
              </span>
            </div>

            <div className="grid gap-px border border-border bg-border">
              {reasons.map((reason, index) => (
                <motion.div
                  key={reason}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.12 + index * 0.06 }}
                  className="bg-bg-deep px-5 py-6"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-sm text-text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-accent/80" />
                  </div>
                  <p className="text-base leading-relaxed text-text-secondary">
                    {reason}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between border-b border-border pb-4 text-sm text-text-muted">
              <span className="label">Redirect</span>
              <span className="max-w-[70%] truncate text-right">{redirectTarget}</span>
            </div>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
