# GOV14-AUTOCLP-01 Handoff Record

- Status: Migration in progress; replacement pending
- Date: 2026-08-28
- Program authority commit: `25fb125a1a656b7a6906d11456f6c7f0a4050363`
- Project baseline before migration: `d416b7c7aec8f5c4fa1ca04ad314f76f7bd94ffe`
- Primary directory: `C:\Users\seven\projects\auto-clp`
- Branch: `main`
- Worktree: clean, sole primary worktree before migration
- Common governance: 1.3.0 → 1.4.0
- Specification: 0.11.0 (unchanged by governance migration)
- Phase: Phase 1 — ローカル3D手動配置試作
- Progress: 98% (unchanged by governance migration)

## Ownership and Routing

- Program coordinator/callback: `PM（SPG）-04`, task `01a04795-86ec-7d32-a6f7-9b1dd4f3c6c8`, host `local`.
- Former/current project coordinator during migration: `PM（AutoCLP）-01`, task `01a041c7-ecae-7561-a27c-d86f080610aa`, host `local`.
- Replacement target: `PM（AutoCLP）-02`, completely new task in the saved project's primary directory; no fork.
- Active Auto CLP task inventory at startup: PM（AutoCLP）-01 only. No active delegated task, unintegrated work, uncommitted exception, or separate Worktree.
- Runtime observation during migration: managed restricted `workspace-write`, restricted network, and automatic escalation review. Repository configuration keeps concurrency at 4; developer/tester are `workspace-write` and the four investigation/review roles are read-only.
- Ownership remains with PM（AutoCLP）-01 until PM（AutoCLP）-02 passes no-change restart verification and its first file-scoped self-routing commit is verified.

## Safe Checkpoint Evidence

At baseline `d416b7c7aec8f5c4fa1ca04ad314f76f7bd94ffe`, each command was executed independently and returned exit code 0:

- `corepack pnpm run typecheck`
- `corepack pnpm run lint`
- `corepack pnpm run test:unit` — 27 files, 875 tests passed.
- `corepack pnpm run test:browser` — 75 tests passed.
- `corepack pnpm run build` — succeeded with the existing large-chunk advisory.
- `& .\scripts\check-data-contract.ps1 -ProjectPath $PWD.Path`
- `& .\scripts\render-governance.ps1 -ProjectPath $PWD.Path -Check`
- `& .\scripts\check-governance.ps1 -ProjectPath $PWD.Path`
- `& .\scripts\check-project.ps1 -ProjectPath $PWD.Path`
- `git diff --check`
- `git diff --cached --check`

The pre-migration capacity command `& .\scripts\check-codex-session-size.ps1 -SessionId '01a041c7-ecae-7561-a27c-d86f080610aa'` returned exit code 0: 55.78 MiB of 300 MiB and `handoff_required: false` under the former 1.3.0 script.

## Migration Validation Evidence

After the 1.4.0 sync and project-owned routing changes, each required command was executed independently and returned exit code 0:

- `corepack pnpm run typecheck`.
- `corepack pnpm run lint`.
- `corepack pnpm run test:unit` — 27 files, 875 tests passed.
- `corepack pnpm run test:browser` — 75 tests passed.
- `corepack pnpm run build` — succeeded with the unchanged large-chunk advisory.
- `& .\scripts\check-data-contract.ps1 -ProjectPath $PWD.Path` — Schema 0.1.0 and specification 0.11.0 current.
- `& .\scripts\render-governance.ps1 -ProjectPath $PWD.Path -Check` — common governance 1.4.0, SHA-256 `d2511f9c2fcb2a90ac43f8c168241fd7cc026da9db1f37b7c66daf10ebfc1d47`.
- `& .\scripts\check-governance.ps1 -ProjectPath $PWD.Path` — generated `AGENTS.md` current at 13,659 bytes within 32,768.
- `& .\scripts\check-project.ps1 -ProjectPath $PWD.Path` — 31 required files, 36 Markdown files, 15 ADRs, 98% roadmap, six valid agent permissions; capacity routing regression included.
- `git diff --check` and `git diff --cached --check`.

The new capacity command returned exit code 0 for the exact current task: 56.64 MiB of 300 MiB (18.88%), `handoff_required: false`. The cached Codex-wide reference was 2,010.91 MiB of 10,240 MiB and `codex_total_warning: false`; `codex_scan_complete: false` with one scan error, so the total is not claimed complete and must not be used for cleanup or a threshold decision. Missing task ID and a known-absent task ID each returned exit code 1 as required.

## Rule Inventory

| Rule area | Preserved destination |
| --- | --- |
| Product scope and sources of truth | `governance/project-rules.md`, `docs/specification.md`, `docs/README.md` |
| Local-only data, synthetic fixtures, safety disclaimers | `governance/project-rules.md`, `docs/specification.md`, `docs/operations.md` |
| Six roles, concurrency 4, least-privilege writes | `.codex/config.toml`, `.codex/agents/*.toml`, `governance/project-rules.md` |
| Independent validation and completion evidence | `governance/project-rules.md`, `docs/operations.md`, `scripts/check-project.ps1` |
| Primary-directory-only Git/worktree policy | `governance/project-rules.md`, `docs/runbooks/project-coordination.md` |
| Event-driven checkpoints, callbacks, turnover | `docs/runbooks/project-coordination.md` |
| Session capacity aliases, exact task ID, 300 MiB/10 GiB policy | `docs/README.md`, `docs/runbooks/project-coordination.md`, `scripts/check-codex-session-size.ps1`, ADR 0016 |
| Current task IDs, migration and restart state | this handoff record and `docs/handoffs/README.md` |

Unmapped project rule count after migration: zero. Project-owned rules and product content are preserved; managed files are updated only by the approved sync script.

## Pending Product Checkpoint

`CP-PHASE1-SCENE-FEEDBACK-001` remains approved and not implemented. It contains wheel-to-page-scroll with button-only camera zoom, positive-area X/Y overlap semantics for retaining or removing a dragged placement, and simplified `大きさ` labels. The planned aligned change is specification 0.12.0 plus ADR 0015, implementation, tests, evidence, operations, roadmap, and changelog. Schema 0.1.0 and progress 98% remain unchanged until verified evidence supports an update.

JSON filename customization remains unapproved. External communication, deployment, external writes, real data, destructive actions, history rewrite, push/fetch/publication, separate Worktrees, and unrelated specification changes remain unapproved.

## Replacement Completion Fields

PM（AutoCLP）-02 must update this section in its first real file-scoped self-routing commit after a successful no-change callback:

- Replacement task ID/host: pending.
- No-change callback: pending.
- Runtime permission/review evidence: pending; must observe managed restricted `workspace-write`, restricted network, and `approvals_reviewer=auto_review` with external writes/escalations reviewed.
- Self-routing commit: pending.
- Active callback destination after transfer: pending.
- Former task disposition: remains unarchived and undeleted; not yet safe to retire ownership.
