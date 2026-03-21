# NovelBench

NovelBench is a live LLM creativity benchmark built as a public arena. Multiple models are put through the same prompt, asked to generate ideas, critique one another anonymously, revise their work, optionally accept human critique, and then vote on the final result.

The point is not to measure one-shot completion quality. The point is to measure creative performance under competition, feedback, revision, and judgment pressure.

## Product Shape

NovelBench is intentionally opinionated:

- creativity is treated as a process, not one answer
- runs, prompts, and projects are public by default
- collaboration matters more than private ownership
- reasoning traces, tool calls, exact URLs, and live draft streaming are product features, not debug extras
- runs are durable, replayable, searchable, and auditable

## Benchmark Flow

Each run moves through four stages:

1. Generate
   - models receive the domain prompt plus the user prompt
   - eligible models can use Exa-backed search when research is enabled
   - outputs are structured and repaired aggressively when JSON is close but malformed
2. Critique
   - models critique and rank ideas anonymously
   - model identity is hidden behind stable labels
3. Human critique
   - this is the only intentional manual checkpoint
   - users can add optional critique before revision
4. Revise and crown
   - models revise their ideas using critique
   - final anonymous voting determines standings

Runs should auto-progress through every stage except the human critique checkpoint.

## Creative Domains

The current domain taxonomy is:

- Venture
- Frontier
- Story
- Cinema
- Folio
- Canvas
- Stage
- Blueprint

Each domain defines:

- prompt framing
- evaluation criteria
- output schema
- quick-start prompt examples

## Current Architecture

NovelBench is fully Convex-first.

- Convex database stores runs, participants, stage state, policies, budgets, jobs, audit logs, and cached read models
- Convex file storage stores large artifacts and exports
- Convex Workflow and Workpool handle durable stage execution
- Convex Auth handles sign-in
- Next.js is the UI shell and route layer
- OpenRouter is the model gateway
- Exa is the optional research gateway

Main path:

`UI -> /api/benchmark -> Convex mutation -> Convex workflow/workpool -> OpenRouter and Exa -> Convex tables/file storage -> realtime queries -> archive/results/leaderboard`

## Data Model

The run model is append-only and normalized:

- `runs` stores the compact run summary
- `runParticipants` stores per-model state, usage, status, and stage outputs
- `runEvents` stores append-only stage and activity events
- `runArtifacts` stores large saved payloads and file storage references
- `jobs` and `jobAttempts` store async work history
- `leaderboardSnapshots`, `categoryStatsDaily`, and related tables power read-heavy pages

The app does not rewrite one giant run blob anymore.

## Public Collaboration

The product direction is public collaboration.

- projects are public
- runs are public
- prompts are public
- collaboration is role-based
- private projects are intentionally out of scope for now

Current role model:

- org roles: `owner`, `admin`, `member`
- project roles: `editor`, `viewer`

The account surface supports:

- BYOK provider keys
- accessible projects/workspaces
- default project selection
- adding collaborators by email
- changing project member roles

## Provider Model

NovelBench is BYOK.

- OpenRouter keys are required to run benchmarks
- Exa keys are optional and only used when policy allows research
- provider keys are encrypted and stored server-side
- provider usage is policy-controlled per org/project

Supported governance includes:

- allowed models
- max models per run
- max concurrent runs
- research enablement
- budget reservation and settlement
- rate-limit buckets
- audit logs and usage tracking

## Query and Read Model Design

Archive, results, and leaderboard use Convex-backed read paths.

- archive browsing uses normalized browse/search query contracts
- prompt search and filters are server-driven
- archive detail is a stable public read surface
- leaderboard and analytics are cached read models, not full rescans on every request

## UI Rules

NovelBench uses an editorial dark interface, not generic SaaS UI.

- prefer typography, spacing, rules, and grid rhythm
- prefer hard edges over rounded cards and pills
- keep controls integrated into the page structure
- avoid detached utility boxes unless a surface already uses one intentionally

When changing UI, match the visual language already established by the landing page, dashboard, arena, archive, and leaderboard.

## Non-Negotiable Implementation Rules

- `src/lib/runtime-config.ts` is the single source of truth for timeouts and runtime limits
- live reasoning/tool-call/draft-token visibility must remain intact for new runs
- archive detail must stay separate from the live arena shell
- workflow step payloads must stay compact
- hot `runs` documents should not be patched for high-frequency live activity when append-only events can be used instead
- if production Convex is patched directly, the repo change must be committed immediately after

## Repository Layout

- `src/app` - routes, pages, API handlers, loading states
- `src/components` - arena, archive, results, leaderboard, auth, UI primitives
- `src/lib` - prompts, providers, parsing, results helpers, runtime config
- `src/hooks` - live Convex-backed run state
- `src/types` - shared run and domain types
- `src/utils` - identity and animation helpers
- `convex` - schema, auth, queries, mutations, actions, workflows, backend helpers
- `docs` - prompt and operational references

## Local Development

Use Bun.

Install:

```bash
bun install
```

Core local app env:

```env
NEXT_PUBLIC_CONVEX_URL=https://glorious-moose-513.convex.cloud
AUTH_SECRET=your_auth_secret
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret
```

Run locally:

```bash
bun run dev
```

## Useful Commands

- `bun run dev`
- `bun run build`
- `bun run lint`
- `bun run test`
- `bun run typecheck`
- `bun run verify`
- `bunx convex deploy -y`

## Convex Production Env

Managed in Convex, not in local app env:

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `PROVIDER_VAULT_MASTER_KEY`
- `LEGACY_MIGRATION_SECRET`
- `SITE_URL`
- JWT auth keys required by Convex Auth

## Notes

- legacy JSON runs have been migrated into the Convex run/event/artifact model
- the current model catalog in code is the source of truth
- prompt behavior is centralized in `src/lib/prompt-copy.ts` and `src/lib/prompts.ts`
- public archive and leaderboard are first-class product surfaces, not debug views
