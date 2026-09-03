# Adopted Governance References

- Status: Active
- Owner: Project index
- 現行の指示入口は[AGENTS](../AGENTS.md)と[project rules](../governance/project-rules.md)。これらのreferenceを通常作業でinstalled skillを読む理由にしない。

| Reference | Status / ownership |
| --- | --- |
| [Document migration 1.0.1](document-migration-contract.md) | 採用した不変reference snapshot。元は明示承認されたinstalled skillの同名契約。変更は別途承認が必要 |
| [Task replacement 2.0.0](task-turnover-contract.md) | Managed snapshot。変更は承認済みsyncのみ |

## Document Tooling Boundary

文書契約が記載するCLIはinstalled 41-file packageには含まれない。今回の移行で承認された実行元は C:\Users\seven\projects\ScaffoldProjectGovernance\scripts\manage-document-migration.ps1 と同ディレクトリのdocument-migration-functions.ps1である。確認した中央revisionは5a02231bd09d222afb9c00d80e70ab535bc7a190。中央ソースとinstalled packageは変更しない。将来利用時はsourceと承認を再確認し、推測したskill配下pathを実行しない。

文書referenceの元は C:\Users\seven\.agents\skills\scaffold-project-governance\references\document-migration-contract.md。正規化LF SHA-256は aa0a8d53995881c042229d70336dd936e46e252124d9477b33550b4cab24b3e3。installed manifestは4ba483f63e7ce086975b7bce8ae39c7864122aa08094fa82210179e7c94eb87d。

[文書対応表](../docs/migrations/document-plan.json)のunitsは中央ValidatePlan/ValidateResultが扱う標準3正本の対応表である。project_extension.supplemental_unitsは、同じ分割・hash方法で取得した追加文書のproject-owned inventoryであり、中央validatorの検査対象に含まれると誤認しない。独立レビューでは元Git・既存1行差分・元hashと実差分を照合する。新設文書は関連ADR・索引・対応表で到達可能性と意味を確認する。交代専用記録として更新し続けない。
