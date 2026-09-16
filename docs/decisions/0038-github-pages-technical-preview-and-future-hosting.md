# 0038 GitHub Pages技術試用版と将来の配信基盤

- Status: Accepted
- Date: 2026-09-16
- Refines: ADR 0001の将来ホスティング方針

## Context

Auto CLPをプレゼンや端末外のブラウザから試用できる状態にする必要がある。一方、将来のサーバー環境、利用者アカウント、サブスクリプション課金は未決定であり、現在は不要なサービスアカウントや特定BaaSへの結合を増やさないことが望ましい。現行アプリは静的クライアントで、CLPデータをIndexedDBまたは利用者が操作するCSV・JSONファイルだけで扱う。

## Decision

- 現行の技術試用版はGitHub Pagesへ公開し、`main`へのpushまたは手動実行を契機にGitHub ActionsでVite成果物を配信する。
- Viteの公開基底pathはbuild時の `AUTO_CLP_BASE_PATH` で指定する。ローカルbuildと開発serverは既定の `/`、Pages workflowはリポジトリ名から `/<repository>/` を設定し、forkまたはリポジトリ名変更時の固定値依存を避ける。
- 公開版も静的クライアントとし、CLP、CSV、JSONの内容をAuto CLPのサーバーへ送信しない。IndexedDBとlocalStorageは公開origin専用であり、localhostや別originの端末保存を自動移行しない。
- GitHub、Googleその他のパスワード、2段階認証情報、復旧コード、個人access tokenはリポジトリ、Actions、文書へ保存しない。Pages配信はGitHub Actionsの限定された `GITHUB_TOKEN` 権限を使う。
- GitHub Pagesは現行の技術試用とプレゼン配信の選択であり、将来の本番配信基盤を固定しない。Firebase Hostingは、既存Googleアカウントを利用でき、Authentication、Firestore、Cloud FunctionsまたはCloud Runへ拡張しやすい将来候補として保持する。
- 認証またはサブスクリプション課金を導入する場合、クライアント表示だけで利用権限を判定せず、決済結果を検証するbackend、webhook、権限保存、失敗・返金・解約・再試行を含む別仕様を承認する。Firebaseを採用する場合もHosting、Authentication、データ保存、backend、課金枠を個別に評価する。
- 今回の公開はアカウント、課金、クラウド保存、共同編集を提供しない技術試用版である。第三者利用者の募集、実在CLPの取扱い、課金または本番運用へ進む前に、利用規約、プライバシー、運用責任、データ取扱いを別checkpointで確認する。

## Consequences

- Users: GitHub Pages URLから試用できる。WebGL 2、対応GPU、ブラウザ保存領域は引き続き必要で、公開URLとlocalhostの端末保存は共有されない。
- Data: Schema `0.1.0`、JSON、CSV、Projectの意味は変更しない。公開配信自体はCLPデータを外部保存しないが、GitHub Pages提供者による一般的なアクセスログはAuto CLPの案件保存とは別に存在し得る。
- Implementation: Viteのbase pathとPages workflowだけを追加する。サーバーSDK、Firebase SDK、analytics、外部APIは追加しない。
- Operations: `main`更新後のActions結果と公開URLを確認する。公開停止はPagesをunpublishし、workflowを無効化または削除する。
- Security: 公開repositoryと配信artifactへ秘密情報または実在顧客データを含めない。公開版へ入力するデータの管理責任は利用者側にあり、Auto CLPは実運送の安全性を保証しない。

## Validation

- 総合9ゲートを公開対象commitで完了する。
- Pages用base pathでproduction buildが成功し、生成したHTMLが `/<repository>/assets/` を参照することを確認する。
- 実際のHTTPS公開URLで初期表示、WebGL 2描画、Drawer、積荷・コンテナ操作、CSV、JSON、IndexedDB、再読込を確認する。
- Actions workflowの成功、公開URL、対象commitを公開記録または完了報告へ残す。

## Rollback

GitHub Pagesをunpublishし、Actions workflowを無効化または削除する。必要ならViteの環境別base指定を戻す。保存形式とCLPデータには変更がないため、データmigrationまたは逆migrationは行わない。

## Reconsider When

利用者認証、クラウド保存、共同編集、subscription、非公開配信、SLA、独自domain、監査またはアクセス制御が必要になった場合。Firebaseを含む候補を、確定した要件と費用上限に基づいて比較する。
