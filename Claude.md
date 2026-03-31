# Claude Guide

Use this as the short operational guide for future agents working in this repo.

## Read First

1. `README.md`
2. `convex/_generated/ai/guidelines.md`
3. `src/lib/categories.ts`
4. `src/lib/models.ts`
5. `src/lib/prompts.ts` and `src/lib/prompt-copy.ts`
6. `src/lib/runtime-config.ts`
7. `convex/schema.ts`
8. `convex/runs.ts`
9. `convex/benchmarkWorkflow.ts`
10. `convex/benchmarkActions.ts`
11. `src/components/arena`
12. `src/components/results`

## What Must Stay True

- NovelBench is a four-stage public creativity benchmark.
- Convex is the backend source of truth.
- Runs are append-only across events, participants, artifacts, jobs, and read models.
- Archive and leaderboard are real public product surfaces.
- Only the human critique checkpoint should pause for user action.
- Live trace visibility is required for new runs.
- Timeout/runtime values come from `src/lib/runtime-config.ts`.

## Frontend Guardrails

- Follow the existing editorial dark UI system.
- Avoid generic cards, pills, chips, rounded SaaS panels, and detached control boxes.
- Prefer hard edges, typography, rules, spacing, and structured layout.
- Keep filters, exports, and controls embedded in the page instead of bolted on.
- If the task is real UI work, use the `frontend-design` skill.

## Backend Guardrails

- Keep workflow payloads compact.
- Avoid hot-doc OCC write amplification for live activity.
- Use append-only events for live reasoning/tool/search traces where possible.
- Use the shared job helpers for async work.
- Keep query semantics unified and server-driven.
- If production Convex is fixed directly, commit and push the same code immediately.

## High-Risk Regression Areas

- removing reasoning/tool/url/live-token trace persistence
- forking timeout values
- routing archive detail through the arena shell
- breaking public archive access
- reintroducing private-project assumptions
- adding split server/client filter behavior
- reintroducing generic cards or pills into editorial surfaces

## Editing Rules

- Use Bun.
- Use `apply_patch`.
- Prefer the smallest correct change.
- Do not revert unrelated user work.
- Do not edit `.next/`, `.next-foundation/`, or `node_modules/`.
- Update tests when parsing or response shape changes.
- Update docs when prompt or behavior contracts change.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `bunx convex ai-files install`.
<!-- convex-ai-end -->
