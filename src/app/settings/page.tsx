import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="border-t border-border pt-8">
        <p className="label mb-4">Settings</p>
        <h1 className="font-display text-4xl text-text-primary sm:text-5xl">
          Public benchmark defaults
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary">
          NovelBench is operating in a public-by-default mode. Benchmark runs,
          archive visibility, and leaderboard participation are all exposed
          publicly. Provider keys still live under your account because they are
          personal secrets, not project settings.
        </p>
      </div>

      <div className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2">
        <section className="bg-bg-deep px-6 py-6">
          <p className="label mb-3">Current defaults</p>
          <div className="space-y-3 text-sm leading-relaxed text-text-secondary">
            <p>Runs are created as public entries.</p>
            <p>Archive pages are readable without sign-in.</p>
            <p>Leaderboard data remains public.</p>
            <p>Private project controls are intentionally absent.</p>
          </div>
        </section>

        <section className="bg-bg-surface px-6 py-6">
          <p className="label mb-3">Account-linked actions</p>
          <div className="space-y-3 text-sm leading-relaxed text-text-secondary">
            <p>GitHub authentication lives in your account.</p>
            <p>OpenRouter and Exa keys are managed from the account page.</p>
            <p>Export actions stay attached to the pages where the data lives.</p>
          </div>
          <div className="mt-6">
            <Link
              href="/account"
              className="text-sm uppercase tracking-[0.18em] text-text-muted transition-colors hover:text-text-primary"
            >
              Open account →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
