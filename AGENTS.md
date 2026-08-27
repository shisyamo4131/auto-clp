# AGENTS.md

<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. -->
<!-- Common governance version: 1.3.0 -->
<!-- Common governance SHA-256: d2cdb79f86e034a533e880ec7c4dddc51ca1e40bbeb16cfde497f1abf41d4e10 -->
<!-- Edit project-specific rules in governance/project-rules.md, then validate. -->
<!-- common-governance-version: 1.3.0 -->
# Common Project Governance Contract

This contract contains mandatory governance shared by every project created or migrated with `scaffold-project-governance`. A project may add stricter or more specific rules, but must not weaken, replace, or silently contradict this contract.

## Instruction Ownership

- Treat this file and the generated root `AGENTS.md` as managed artifacts. Do not edit them in the project.
- Put project-specific instructions in `governance/project-rules.md` and project facts in the task-routed authoritative documents.
- Regenerate managed artifacts with the project renderer after an approved common-contract update.
- Reject direct changes to managed artifacts, stale hashes, an oversized generated `AGENTS.md`, or a project rule that weakens this contract.
- Keep the common contract concise. Route detailed product, environment, command, data, and operational guidance through project-owned documents.

## Non-negotiable Coordinator Gate

Before any file write, delegation, Git mutation, external write, implementation, or completion claim, the coordinator must:

1. Read the active `AGENTS.md`, `governance/project-rules.md`, and the smallest task-routed authoritative document set.
2. Identify the current phase, confirmed scope, source of truth, unresolved decisions, and existing behavior that may already satisfy the request.
3. State or internally verify the allowed files, forbidden scope, approval boundaries, required validation, fallback or rollback, and completion contract.
4. Separate confirmed facts, reasonable but unconfirmed assumptions, open decisions, and repository conflicts.

If any required item is missing, stale, contradictory, or unauthorized, remain read-only and obtain direction. Do not bypass this gate because a change appears small, beneficial, obvious, or reversible.

## Source of Truth and Reading

- Keep one current confirmed specification. Use Git for previous text, ADRs for decision rationale, roadmaps for evidence-backed progress, and the changelog for concise visible changes.
- Use the project documentation map to select the smallest sufficient reading set. Do not require every task to load every document.
- Keep important documents reachable from a root or product/domain index. Update indexes and inbound links in the same change when a document is added, renamed, moved, or retired.
- Do not use chat history as the sole source of requirements, decisions, progress, operations, ownership, or restart state.
- Distinguish implemented, planned, proposed, unavailable, and historical behavior.

## Approval and Specification Changes

- Do not convert brainstorming, questions, comparisons, research, or assumptions into confirmed requirements.
- Treat explicit adoption or change instructions as approval only for the stated scope.
- Before a material change, present the current rule, proposed rule, reason, impact, compatibility, migration, rollback, and required tests.
- After approval, update the specification, affected roadmaps, relevant ADRs and index, changelog, implementation, tests, operations, and user documentation in the same task.
- If the full update cannot be completed, list every unreflected surface and do not claim completion.
- Ask at most three confirmation or approval questions per round. State why each answer is needed and what changes with the answer.

## Multi-agent Coordination

- Keep the user-facing primary task as coordinator. Do not create a separate coordinator subagent.
- Use only roles whose results are needed. Keep application-code writes concentrated in the developer; allow the tester to edit tests only when explicitly delegated; keep explorer, researcher, reviewer, security review, and release review read-only unless a project contract explicitly requires otherwise.
- Prefer parallel work only for independent scopes. Never allow overlapping parallel writes without explicit disjoint ownership.
- Give every delegated checkpoint its ID, common baseline, owned and forbidden files, source of truth, completion contract, validation, approval boundary, and callback destination.
- A delegated task normally stops after editing and validation, then reports exact files, diff, tests, unverified items, approval boundaries, and worktree state. The coordinator reviews and commits accepted files.
- Never treat unintegrated work as a confirmed dependency. Prioritize review and integration over launching another write cycle.
- Wait for all requested evidence before consolidating or claiming completion.

## Event-driven Checkpoints

- For ongoing coordination, issue one reviewable checkpoint at a time and wait for one completion, failure, specification-question, or approval-boundary callback before issuing the next.
- Establish the user-defined work-session ending condition before ongoing assignments.
- After task creation, replacement, or application restart, verify the route with a no-change callback before real work.
- A callback must identify the checkpoint and terminal state, exact files, diff, tests, unverified items, approval boundaries, and worktree state. After notification, the task waits.
- If callback delivery fails, do not retry repeatedly. Preserve the complete report in the delegated task and stop for recovery.
- Use scheduled polling only when callbacks are unavailable or the user explicitly selects it. Keep unchanged polls silent and delta-only; cadence is not a task deadline.

## Git and Worktree Integrity

- Use the repository in the primary working directory configured by the user for every project task. Do not create, select, or assign a task-specific linked worktree or alternate repository copy by default.
- Before using a separate worktree, explain why the primary working directory is insufficient and obtain explicit user approval. State the proposed path, branch, owner, integration method, lifetime, and cleanup plan. If an unapproved separate worktree is discovered, stop state-changing work there, preserve it, and ask the user for direction; do not delete it automatically.
- Preserve unrelated user changes. Do not discard, overwrite, stage, or commit files outside the accepted owned scope.
- Prefer coordinator-owned Git integration. Stage only reviewed files and reuse an existing reviewed delegated-task commit instead of duplicating it.
- Before handoff, require retiring tasks to validate their owned work and report exact files, diff, tests, unverified items, and worktree state. The coordinator commits and integrates accepted work.
- Require a clean worktree at handoff. If an exception is unavoidable, record files, purpose, verification, reason, owner, and restart procedure, and prevent duplicate ownership.
- Do not push, deploy, delete material data, rewrite history, or perform other external or destructive actions without separate authorization.

## Governance-change Task Turnover

- Treat changes to this common contract, root `AGENTS.md`, project Codex permissions, approval policy, coordinator responsibilities, delegation/Git integration, callback/handoff rules, or safety boundaries as instruction-chain changes.
- After an approved instruction-chain change, stop new assignments at a safe checkpoint, validate and commit owned work, generate and verify the new governance artifacts, then replace every affected active task with a completely new task. Do not fork old task history.
- Replace all active project tasks for a common contract, root `AGENTS.md`, project-wide permission, or approval-policy change. Replace only the affected role plus its coordinator when a role-specific agent definition changes.
- Routine specification, roadmap, ADR, changelog, evidence, or implementation updates do not require turnover unless they change scope ownership, approval boundaries, safety, current phase, or task instructions.
- Require explicit user approval before replacing the coordinator. Delegated tasks may rotate automatically only under previously approved conditions and at a safe checkpoint.
- Use the same base task name plus the next sequence number. Send the baseline commit, checkpoint, progress, results, tests, unintegrated work, approvals, owned and forbidden scope, next instructions, governance version, and callback destination.
- Verify repository-based restart, active instruction sources, project permissions, a no-change callback, and retargeted assignment/callback identifiers before retiring ownership from the former task. On failure, keep the former task active and prevent duplicate assignments.
- After successful replacement, leave the former task in place and do not archive or delete it through Codex. Tell the user which former task is safe to delete manually; deletion remains a user action. Do not make direct maintenance of Codex-owned SQLite or WAL files a routine project procedure.

## Roadmaps and Progress

- Use roadmaps for ongoing, multi-phase, multi-product, or autonomously coordinated work. Keep them separate from confirmed requirements.
- Base progress on verified deliverables or completed gates, not elapsed time or unverified self-report.
- Weighted milestones must total 100 and state whether partial credit is allowed. Do not average materially different products without approved program weighting.
- If scope growth or corrected completion judgment lowers progress, record the old value, new value, and reason.
- Link milestones to principal design, implementation, test, review, deployment, or acceptance evidence.

## Verification Evidence Integrity

- Run every required validator, test, build, lint, migration check, or other completion gate so that its result and exit status are independently observable.
- When combining required checks, use only a verified fail-fast wrapper that exits nonzero on the first failure or a verified aggregate runner that records every result and exits nonzero if any check fails.
- Do not use command chaining such as `;` as completion evidence when a later successful command can replace an earlier failure in the overall process exit status.
- Record each required check's command, result, and exit status separately in callbacks, completion reports, handoffs, commit or integration evidence, and release decisions.
- Diagnostic command batches may use other grouping for investigation, but must be labeled diagnostic and must not be reused as completion evidence or a success decision.

## Safety and Sensitive Information

- Never place secrets, credentials, session data, private production records, or unredacted confidential samples in repository documents, prompts, tests, logs, or generated artifacts.
- Do not invent commands, environments, test results, implementation status, compliance claims, external-service behavior, business facts, or operational capabilities.
- Keep network access and external writes disabled unless separately approved. Apply least privilege to project roles and tools.
- Mark unimplemented, unavailable, unverified, and planned behavior clearly.
- Keep project-specific sensitive-data rules and external-effect boundaries in `governance/project-rules.md` and the authoritative specification/operations documents.

## Completion Gate

Before completion, verify and report:

- changed behavior and exact changed files;
- owned diff and worktree state;
- specification, roadmap, ADR, changelog, operations, and index alignment;
- each required validation and test command, its result, and its independently determined exit status;
- unverified items, residual risks, unresolved decisions, and pending approvals;
- governance/configuration changes and required task turnover;
- the user's next action.

Do not claim completion while required work, validation, integration, documentation, or approval remains outstanding.

## Project-specific Rules

Before any write, delegation, Git mutation, external action, implementation, or completion claim, read `governance/project-rules.md` and the task-routed authoritative documents it identifies. Project-specific rules may be stricter than the common contract but must not weaken or contradict it.
