# Task Replacement

- Contract version: `2.0.0`
- Status: Active

When the user requests task replacement:

1. Update existing authoritative project information and next work. Commit relevant changes in sensible groups and leave the primary repository clean. Do not create per-edit/task-action or gratuitous empty commits.
2. Create a fresh non-fork task in that primary project, using the same base name and next sequence number from the current task or user instruction. It follows the normal repository startup below.

Every task reads `AGENTS.md`, `governance/project-rules.md` and routed repository authorities before project work. Manual creation and recovery after the old task becomes unavailable use the same startup, without an old task ID or old-owner cooperation.

No handshake, task registry, history, cache, generation, replacement validator or profile is required. Governance edits do not force task rotation. Ordinary project work does not load the installed scaffold skill.
