# AUTOCLP-PM03-01 Handoff Record

- Status: Replacement approved; PM（AutoCLP）-02 remains active until PM（AutoCLP）-03 verification and self-routing commit complete
- Date: 2026-08-31
- Owner approval: PM（AutoCLP）-03 coordinator replacement explicitly approved by the user
- Baseline commit before this handoff-preparation record: `2d359e5fee57f05cff1c278b68660d0f3ac60073` (`feat: consolidate creation controls in drawer`)
- Primary directory: `C:\Users\seven\projects\auto-clp`
- Branch: `main`
- Worktree: clean, sole primary worktree before this handoff-preparation change; no active delegated task, unintegrated work, or uncommitted exception
- Common governance: 1.4.0, SHA-256 `d2511f9c2fcb2a90ac43f8c168241fd7cc026da9db1f37b7c66daf10ebfc1d47`; generated `AGENTS.md` 13,659 bytes
- Specification: 1.3.0
- Schema: 0.1.0
- Phase: Phase 1 — ローカル3D手動配置試作
- Progress: 98%

## Ownership and Routing

- Retiring project coordinator: `PM（AutoCLP）-02`, task `01a047cc-4560-7e93-9dac-c91a196a6101`, host `local`. It remains the sole project owner and callback destination until the replacement no-change callback is accepted and the replacement's first real file-scoped self-routing commit is independently verified.
- Replacement project coordinator: `PM（AutoCLP）-03`, task ID/host pending creation as a completely new task. Do not fork history or create/select a linked Worktree. Use the saved project's primary directory directly and exclusively.
- Program coordinator/callback remains `PM（SPG）-04`, task `01a04795-86ec-7d32-a6f7-9b1dd4f3c6c8`, host `local`.
- Expected replacement runtime policy: managed restricted `workspace-write`, restricted network, `approvals_reviewer=auto_review`, with external writes and escalations reviewed. Repository configuration retains concurrency 4, two `workspace-write` roles, and four read-only investigation/review roles.
- After verified ownership transfer, future Auto CLP delegated callbacks route to PM（AutoCLP）-03. PM（AutoCLP）-02 ownership retires, remains unarchived and undeleted by Codex, and is safe for user manual deletion only after explicit confirmation.

## Reason for Replacement

The user approved a voluntary coordinator replacement after application restarts split the current task's persisted history across two JSONL files. The required command

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-codex-session-size.ps1 -SessionId 01a047cc-4560-7e93-9dac-c91a196a6101
```

returned exit code 1 with `found 2`. Under common governance 1.4.0 and ADR 0016, no current-session capacity, usage percentage, `handoff_required`, Codex-wide total, scan completeness, or threshold decision is claimed. Read-only file metadata suggested a restart boundary rather than parallel ownership, but that diagnostic inference is not used as formal capacity evidence. No Codex-owned session, database, WAL, or cache was edited or deleted.

## Product State and Verification Baseline

- Specification 1.3.0 and ADR 0029 implement the viewer-first shell checkpoint: right-edge menu, Drawer outside-click close, Drawer-only cargo/candidate add entry points, and removal of the automatic-proposal UI from the Phase 1 normal page while retaining its future technical assets.
- The same human project evaluator reported the tested 1.3.0 behavior as acceptable after an accidental reload/reload sequence that did not affect the test result.
- Commit `2d359e5fee57f05cff1c278b68660d0f3ac60073` independently passed typecheck, lint, 28 unit files / 952 tests, 83 current browser tests, build with the existing large-chunk advisory, data-contract, render-governance, governance, project, and Git whitespace checks. Product tests need not be rerun for the handoff-only record unless repository state differs.
- The loopback UI trial server was not listening on `127.0.0.1:4174` during handoff preparation. No server process is transferred as owned work.

## Pending Product Decision

The user observed that the persistent main-page cargo card and container/vehicle-candidate card may now be unnecessary and first requested the coordinator's view. The current specification still requires both cards for count/list/edit/delete, so removal is not yet a confirmed specification change.

Recommended proposal awaiting explicit approval:

1. Remove the cargo card because it now provides only count/guidance while the viewport selector/context row and Drawer add entry cover cargo CRUD.
2. Before removing the candidate card, move candidate list/add/edit/delete into a Drawer-triggered management dialog; keep the external scene tabs as switch-only controls.
3. Remove the now-redundant main-page CLP input region after all candidate management operations have a compact replacement.

If approved, align specification, roadmap, ADR/index, changelog, operations, implementation, automated tests, and differential human verification. Schema 0.1.0 and progress 98% remain unchanged unless verified evidence justifies otherwise.

## Approval Boundaries and Next Checkpoint

- Approved: local coordinator replacement and the documentation/Git operations required to verify it.
- Not approved: the pending card-removal product proposal, JSON filename customization, external communication, deployment, external writes, real data, destructive actions, history rewrite, push/fetch/publication, separate Worktrees, or unrelated specification changes.
- Replacement checkpoint: `AUTOCLP-PM03-RESTART`. PM（AutoCLP）-03 must read the repository instruction chain and latest handoff, verify exact cwd/root/branch/HEAD/clean status/diffs/sole Worktree, governance/config/runtime policy, run the required no-change checks independently, and send exactly one callback to PM（AutoCLP）-02. It must not write, delegate, stage, commit, or start product work before that callback is accepted.
- After an accepted VERIFIED callback, PM（AutoCLP）-02 will issue one two-file self-routing assignment limited to this record and the handoff index. Ownership transfers only after the resulting local commit is independently verified.
