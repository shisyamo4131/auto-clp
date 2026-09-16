import { useEffect, useState } from "react";

import {
  prepareCargoCsvImport,
  type CargoCsvReplacementResult,
} from "../application/cargo-csv-import";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import type { Project } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";
import { cargoCsvSourceFromFile } from "../persistence/cargo-csv-file";
import { ModalShell } from "./ModalShell";

export interface CargoCsvImportRequest {
  readonly baseProject: Project;
  readonly file: File;
  readonly key: number;
  readonly returnScrollPosition: { readonly left: number; readonly top: number };
}

interface CargoCsvImportDialogProps {
  readonly onApplied: () => void;
  readonly onClose: () => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly request: CargoCsvImportRequest;
}

function issueMessage(issue: ValidationIssue): string {
  const messages: Record<string, string> = {
    "cargo-csv.import-unavailable": "このブラウザではCSVファイルを読み込めません。",
    "cargo-csv.file-size": "CSVが5 MiBの上限を超えているか、サイズを安全に確認できません。",
    "cargo-csv.read": "CSVを読み取れませんでした。",
    "cargo-csv.utf8": "CSVはUTF-8ではありません。CSV UTF-8形式で保存してください。",
    "cargo-csv.syntax": "CSVの引用符または改行の形式が正しくありません。",
    "cargo-csv.header": "CSVの見出しがテンプレートと一致しません。",
    "cargo-csv.record-count": "積荷データは1〜30件にしてください。",
    "cargo-csv.column-count": "列数がテンプレートと一致しない行があります。",
    "cargo-csv.name-required": "積荷名が空です。",
    "cargo-csv.name-length": "積荷名は120文字以内にしてください。",
    "cargo-csv.name-control": "積荷名に制御文字は使用できません。",
    "input.mm-length": "mmの入力桁数が上限を超えています。",
    "input.mm-format": "mmは半角数字だけの整数で入力してください。",
    "input.mm-range": "mmの値が1〜100,000の範囲外です。",
    "input.kg-length": "kgの入力桁数が上限を超えています。",
    "input.kg-format": "kgは半角数字で、小数は3桁まで入力してください。",
    "input.kg-range": "kgの値が0.001〜100,000の範囲外です。",
    "cargo-csv.candidate-invalid": "置換後のCLPを安全に検証できません。",
  };
  return `${messages[issue.code] ?? "CSVを検証できません。"}（${issue.code} ${issue.path}）`;
}

export function CargoCsvImportDialog({
  onApplied,
  onClose,
  onProjectCommit,
  request,
}: CargoCsvImportDialogProps) {
  const [result, setResult] = useState<CargoCsvReplacementResult>();
  const [status, setStatus] = useState("CSVを読み取り、全件を検証しています…");

  useEffect(() => {
    let cancelled = false;
    const source = cargoCsvSourceFromFile(request.file);
    if (source === undefined) {
      queueMicrotask(() => {
        if (cancelled) return;
        setResult({
          ok: false,
          project: request.baseProject,
          issues: [{ code: "cargo-csv.import-unavailable", path: "/file" }],
        });
        setStatus("");
      });
      return () => {
        cancelled = true;
      };
    }
    void prepareCargoCsvImport(request.baseProject, source).then((prepared) => {
      if (cancelled) return;
      setResult(prepared);
      setStatus("");
    });
    return () => {
      cancelled = true;
    };
  }, [request.baseProject, request.file]);

  const apply = () => {
    if (result === undefined || !result.ok) return;
    if (!result.changed) {
      setStatus("現在の積荷と同じ内容のため変更しませんでした。");
      return;
    }
    const transition = onProjectCommit({
      baseProject: request.baseProject,
      nextProject: result.project,
      action: "cargo.csv-replace",
    });
    if (!transition.ok) {
      setStatus("検証後にCLPが更新されたため置換しませんでした。CSVを選び直してください。");
      return;
    }
    if (!transition.changed) {
      setStatus("現在の積荷と同じ内容のため変更しませんでした。");
      return;
    }
    onApplied();
    onClose();
  };

  return (
    <ModalShell
      fallbackFocusIds={["app-navigation-button"]}
      initialFocusId={result?.ok === true ? "cargo-csv-confirm" : "cargo-csv-close"}
      returnScrollPosition={request.returnScrollPosition}
      title="CSVで積荷を一括登録"
      onRequestClose={onClose}
    >
      {status === "" ? null : <p className="action-status" role="status">{status}</p>}
      {result === undefined ? (
        <p aria-live="polite">ファイル全体の検証が終わるまで、現在のCLPは変更しません。</p>
      ) : result.ok ? (
        <>
          <div className="confirm-panel" role="alert">
            <p>
              新規積荷<strong>{result.summary.newCargoCount}件</strong>を一括登録します。
              {"既存の積荷と配置情報は破棄されます。"}
            </p>
            <p>CLP名、隙間、コンテナは保持します。端末保存は自動更新しません。</p>
          </div>
          <div className="button-row modal-shell__actions">
            <button
              id="cargo-csv-confirm"
              className="danger-button"
              type="button"
              disabled={!result.changed}
              onClick={apply}
            >
              積荷と配置の置換を確定
            </button>
            <button id="cargo-csv-close" type="button" onClick={onClose}>
              {result.changed ? "置換をやめる" : "閉じる"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="error-summary" role="alert" tabIndex={-1}>
            <strong>CSVを読み込めませんでした</strong>
            <ul>
              {result.issues.map((issue) => (
                <li key={`${issue.path}-${issue.code}`}>{issueMessage(issue)}</li>
              ))}
            </ul>
          </div>
          <p>現在のCLP、履歴、選択、3D表示は変更していません。</p>
          <button id="cargo-csv-close" type="button" onClick={onClose}>閉じる</button>
        </>
      )}
    </ModalShell>
  );
}
