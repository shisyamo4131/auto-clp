# Indexed Document Migration Contract

- Contract version: `1.0.1`
- Status: Active
- Scope: Read-only shape diagnosis, migration-plan preparation, zero-unmapped validation, bounded index synchronization, and post-migration verification

## Safety Boundary

This contract does not authorize a downstream-project change. Diagnose and plan are read-only. `SyncIndex` may write only the explicitly selected index file and only its marker-bounded generated block; using it against an existing project requires that project's approval and task. Content migration, managed-governance synchronization, installation, push, release, deletion, and history rewriting remain separate operations.

Never infer an unknown structure. Stop on a partial standard layout, stale plan hash, malformed generated markers, duplicate authority, unmapped source unit, unsafe target path, or missing post-migration target.

## Detected Shapes

| Shape | Deterministic meaning | Safe next policy |
| --- | --- | --- |
| `legacy_single` | An unmanaged root `AGENTS.md` exists and no standard or indexed split signal exists | Inventory every Markdown unit, prepare explicit mappings, and do not replace `AGENTS.md` until the plan validates |
| `standard_split` | Generated `AGENTS.md` plus every required managed/project-owned standard surface exists | Preserve the standard structure; map project-owned units to their existing authorities |
| `custom_split` | An indexed project-specific Markdown structure exists without any partial standard-governance footprint | Preserve its authorities and map each unit before proposing standardization |
| `mixed` | Only part of the standard structure exists, or standard and unmanaged authority signals compete | Stop automatic preparation and resolve ownership explicitly |
| `unknown` | Available files do not prove one of the other shapes | Record unknown and obtain more evidence |

The standard detector requires generated `AGENTS.md`, `governance/common-governance.md`, `governance/project-rules.md`, `governance/governance.lock.toml`, `governance/verification-policy.json`, and `docs/README.md`. Extra project documents do not make a complete standard layout custom.

## Inventory Unit

A source inventory is content-free metadata. Each Markdown preamble or ATX-heading section becomes one unit containing:

- repository-relative source path;
- deterministic unit ID and heading label;
- normalized-LF SHA-256 of the complete unit;
- mapping state, disposition, target path, authority ID, and optional rationale.

The plan does not copy source text. Its hash binds review to the inspected source without placing private content into a central plan.

## Command Interface

Run the maintained CLI from the skill package. Replace paths only with values confirmed in the current target turn:

```powershell
& <skill-root>\scripts\manage-document-migration.ps1 -Action Diagnose -ProjectPath <target>
& <skill-root>\scripts\manage-document-migration.ps1 -Action NewPlan -ProjectPath <target> -OutputPath <target>\docs\migrations\document-plan.json
& <skill-root>\scripts\manage-document-migration.ps1 -Action ValidatePlan -ProjectPath <target> -PlanPath <plan>
& <skill-root>\scripts\manage-document-migration.ps1 -Action SyncIndex -ProjectPath <target> -PlanPath <plan>
& <skill-root>\scripts\manage-document-migration.ps1 -Action ValidateResult -ProjectPath <target> -PlanPath <plan>
```

`NewPlan` refuses to replace a different existing plan and returns `unchanged` for identical content. `ValidatePlan` is the mandatory pre-migration gate. `ValidateResult` is the post-migration topology gate; it does not replace the target project's selected completion suite.

## Plan and Zero-Unmapped Gate

`NewPlan` creates contract `1.0.1` JSON with the detected shape and all inventory units marked `unmapped`. Validators continue to accept well-formed `1.0.0` plans; `1.0.1` relaxes index-link cardinality and strengthens bidirectional authority/target uniqueness without changing the inventory, mapping, authority, target, or rollback schema. Reviewers assign every unit exactly once:

- `move`: the unit will move to a project-owned target;
- `retain`: the unit remains at its existing project-owned target;
- `retire`: the unit is intentionally removed and requires a non-empty rationale.

`ValidatePlan` succeeds only when the current shape still matches, each expected source unit occurs exactly once with the current hash, no unexpected unit exists, no unit remains unmapped, and target paths are safe project-relative Markdown paths. Authority and canonical target paths are unique in both directions: one authority ID cannot name multiple targets, and one canonical target cannot have multiple authority IDs. Managed `AGENTS.md`, common governance, and the governance lock cannot receive migrated project content.

The zero-unmapped gate proves mapping completeness, not semantic correctness. Human review remains responsible for whether a target authority is appropriate and whether a retirement rationale is acceptable.

## Index Synchronization

`SyncIndex` first applies the complete plan validation. For every distinct canonical `move` or `retain` target, it preserves all project-owned relative Markdown links outside the generated block and renders one generated link only when none exists outside the block. It writes only the block between:

```text
<!-- BEGIN MANAGED DOCUMENT MIGRATION INDEX -->
<!-- END MANAGED DOCUMENT MIGRATION INDEX -->
```

Existing text outside the block is preserved byte-for-text after UTF-8 decoding. A missing index is created from `assets/templates/document-index.md.template`. Identical output returns `unchanged`. Missing, duplicated, reversed, or malformed markers fail before any write.

Creating the first index can temporarily make a legacy layout appear `mixed`. A repeat synchronization is permitted only when the original source units and hashes still match and that exact index contains both managed markers; unrelated partial-standard layouts remain stopped.

## Post-migration Validation

`ValidateResult` reruns the plan's contract, zero-unmapped, target, authority, and rollback checks, requires the detected current shape to equal the plan's target shape, requires every mapped target and the declared index to exist, and verifies each target has at least one relative Markdown link from the index. Multiple project-owned contextual links to the same target are valid and remain preserved. It uses the reviewed source hashes retained in the plan because moved or retired source units may no longer exist at their original paths. It rejects duplicate authority ownership and broken or missing routes. It does not claim that managed governance has been synchronized or that project tests pass; those remain project completion gates.

## Compatibility and Rollback

- Detection and plan generation are read-only and work for single, standard, custom, mixed, and unknown fixtures.
- Index synchronization is idempotent and bounded to a generated block.
- No line count or file size causes a split. Responsibility, update frequency, reader route, and independent authority/rollback remain the decision criteria.
- Before an actual migration, record a Git baseline or an equivalent approved snapshot. Apply the structural change as one reviewable unit. On mapping, link, authority, or comprehensive-validation failure, restore that complete unit; do not retain a dual-authority partial migration.
