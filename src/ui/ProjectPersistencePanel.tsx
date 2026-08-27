import { useEffect, useRef, useState, type ChangeEvent } from "react";

import type {
  ProjectPersistenceActionResult,
  ProjectPersistenceFailureCode,
} from "../application/project-persistence";
import type { Project } from "../domain/model";
import {
  isProjectFileExportAvailable,
  isProjectFileImportAvailable,
} from "../persistence/project-file";
import { isProjectStoreAvailable } from "../persistence/project-store";

type PersistenceAction =
  | "save-device"
  | "load-device"
  | "delete-device"
  | "export-file"
  | "import-file";

interface ProjectPersistencePanelProps {
  readonly busy: boolean;
  readonly onDeleteDevice: (baseProject: Project) => Promise<ProjectPersistenceActionResult>;
  readonly onExportFile: (baseProject: Project) => Promise<ProjectPersistenceActionResult>;
  readonly onImportFile: (
    baseProject: Project,
    file: File,
  ) => Promise<ProjectPersistenceActionResult>;
  readonly onInteractionChange: (active: boolean) => void;
  readonly onLoadDevice: (baseProject: Project) => Promise<ProjectPersistenceActionResult>;
  readonly onSaveDevice: (baseProject: Project) => Promise<ProjectPersistenceActionResult>;
  readonly project: Project;
}

const failureCopy = {
  "persistence.operation-busy":
    "未保存入力、削除確認、3D移動、または別の保存操作を完了してからやり直してください。",
  "persistence.stale-base":
    "操作中に案件が更新されたため処理を完了しませんでした。現在の案件は変更していません。",
  "persistence.unexpected-failure":
    "保存処理で予期しない問題が発生しました。現在の案件は変更していません。",
  "persistence.serialize-failed":
    "案件を書き出し用データへ変換できませんでした。現在の案件は変更していません。",
  "persistence.serialize-invalid":
    "現在の案件が保存データ契約に適合しないため保存できませんでした。",
  "persistence.serialize-size-exceeded":
    "案件データが5 MiBの保存上限を超えるため保存できませんでした。",
  "persistence.import-size-invalid":
    "読込データのサイズを安全に確認できないため拒否しました。",
  "persistence.import-size-exceeded":
    "読込データが5 MiBの上限を超えるため拒否しました。",
  "persistence.import-read-failed":
    "データを読み取れませんでした。現在の案件は変更していません。",
  "persistence.import-syntax-invalid":
    "JSONの形式が正しくないため拒否しました。現在の案件は変更していません。",
  "persistence.import-version-unsupported":
    "対応していない案件データ版のため拒否しました。",
  "persistence.import-schema-invalid":
    "案件データの構造または値域が契約に適合しないため拒否しました。",
  "persistence.import-semantic-invalid":
    "案件データのID、参照、向き、開口、または重量整合性を確認できないため拒否しました。",
  "persistence.import-preflight-failed":
    "全候補の物理判定を安全に再計算できないため読込を拒否しました。",
  "persistence.device-unavailable":
    "このブラウザでは端末内保存を利用できません。JSON書き出しを利用してください。",
  "persistence.device-open-failed":
    "端末内保存領域を開けませんでした。現在の案件は変更していません。",
  "persistence.device-read-failed":
    "端末内保存を読み取れませんでした。現在の案件は変更していません。",
  "persistence.device-write-failed":
    "端末内保存を完了できませんでした。成功として扱っていません。",
  "persistence.device-delete-failed":
    "端末内保存を削除できませんでした。保存コピーが残っている可能性があります。",
  "persistence.device-not-found":
    "読込できる端末内保存はありません。",
  "persistence.device-data-invalid":
    "端末内保存の形式を安全に読み取れないため拒否しました。",
  "persistence.file-import-unavailable":
    "このブラウザではJSONファイル読込を利用できません。",
  "persistence.file-export-unavailable":
    "このブラウザではJSONファイル書き出しを利用できません。",
  "persistence.file-download-failed":
    "JSONファイルのダウンロードを開始できませんでした。",
} satisfies Record<ProjectPersistenceFailureCode, string>;

const successCopy = {
  "save-device": "現在の案件をこの端末へ保存しました。",
  "load-device":
    "端末内保存を読み込みました。以前の操作履歴は破棄し、物理判定を再計算しています。",
  "delete-device": "端末内の保存コピーを削除しました。",
  "export-file": "検証済み案件JSONのダウンロードを開始しました。",
  "import-file":
    "案件JSONを読み込みました。以前の操作履歴は破棄し、物理判定を再計算しています。",
} satisfies Record<PersistenceAction, string>;

export function ProjectPersistencePanel({
  busy,
  onDeleteDevice,
  onExportFile,
  onImportFile,
  onInteractionChange,
  onLoadDevice,
  onSaveDevice,
  project,
}: ProjectPersistencePanelProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [operation, setOperation] = useState<PersistenceAction>();
  const [status, setStatus] = useState("");
  const busyRef = useRef(busy);
  const operationRef = useRef(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const restoreDeleteFocusRef = useRef(false);
  const interactionActive = deleteConfirmation || operation !== undefined;
  const deviceAvailable = isProjectStoreAvailable();
  const fileImportAvailable = isProjectFileImportAvailable();
  const fileExportAvailable = isProjectFileExportAvailable();

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    onInteractionChange(interactionActive);
    return () => onInteractionChange(false);
  }, [interactionActive, onInteractionChange]);

  useEffect(() => {
    if (deleteConfirmation) {
      deleteConfirmButtonRef.current?.focus();
      return;
    }
    if (!restoreDeleteFocusRef.current) {
      return;
    }
    restoreDeleteFocusRef.current = false;
    deleteButtonRef.current?.focus();
  }, [deleteConfirmation]);

  const run = async (
    action: PersistenceAction,
    execute: () => Promise<ProjectPersistenceActionResult>,
  ): Promise<boolean> => {
    if (operationRef.current) {
      setStatus(failureCopy["persistence.operation-busy"]);
      return false;
    }
    operationRef.current = true;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
    if (busyRef.current) {
      operationRef.current = false;
      setStatus(failureCopy["persistence.operation-busy"]);
      return false;
    }
    setOperation(action);
    setStatus("処理中です。完了するまで案件を閉じたり再読み込みしたりしないでください。");
    let result: ProjectPersistenceActionResult;
    try {
      result = await execute();
    } catch {
      result = { ok: false, code: "persistence.unexpected-failure" };
    } finally {
      operationRef.current = false;
      setOperation(undefined);
    }
    setStatus(result.ok ? successCopy[action] : failureCopy[result.code]);
    return result.ok;
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (file === undefined) {
      return;
    }
    void run("import-file", () => onImportFile(project, file));
  };

  const controlsDisabled = busy || operation !== undefined || deleteConfirmation;

  return (
    <section className="project-persistence" aria-labelledby="project-persistence-title">
      <div className="project-persistence__heading">
        <div>
          <p className="eyebrow">LOCAL PERSISTENCE</p>
          <h2 id="project-persistence-title">保存・再読込</h2>
        </div>
        <p>自動保存・自動読込は行いません。</p>
      </div>

      <div className="project-persistence__groups">
        <div className="project-persistence__group">
          <h3>このブラウザ内</h3>
          <div className="button-row">
            <button
              type="button"
              disabled={controlsDisabled || !deviceAvailable}
              onClick={() => void run("save-device", () => onSaveDevice(project))}
            >
              端末へ保存
            </button>
            <button
              type="button"
              disabled={controlsDisabled || !deviceAvailable}
              onClick={() => void run("load-device", () => onLoadDevice(project))}
            >
              端末保存を読込
            </button>
            <button
              id="project-persistence-delete-device"
              ref={deleteButtonRef}
              type="button"
              className="danger-button"
              disabled={controlsDisabled || !deviceAvailable}
              onClick={() => {
                restoreDeleteFocusRef.current = true;
                setDeleteConfirmation(true);
                setStatus("端末内の保存コピーを削除するか確認してください。");
              }}
            >
              端末保存を削除
            </button>
          </div>
          {!deviceAvailable ? (
            <p className="project-persistence__availability">
              このブラウザでは端末内保存を利用できません。
            </p>
          ) : null}
        </div>

        <div className="project-persistence__group">
          <h3>JSONファイル</h3>
          <div className="button-row">
            <button
              type="button"
              disabled={controlsDisabled || !fileExportAvailable}
              onClick={() => void run("export-file", () => onExportFile(project))}
            >
              JSONを書き出す
            </button>
            <label className="file-input-button" aria-disabled={controlsDisabled || !fileImportAvailable}>
              JSONを読み込む
              <input
                type="file"
                accept=".json,application/json"
                data-project-history-shortcuts="local"
                disabled={controlsDisabled || !fileImportAvailable}
                onChange={handleFile}
              />
            </label>
          </div>
          {!fileImportAvailable || !fileExportAvailable ? (
            <p className="project-persistence__availability">
              このブラウザではJSONファイルの読込または書出しの一部を利用できません。
            </p>
          ) : null}
        </div>
      </div>

      {deleteConfirmation ? (
        <div className="confirm-panel" role="alert">
          <p>
            このブラウザの手動保存スロットを削除します。現在画面にある案件とJSONファイルは削除しません。
          </p>
          <div className="button-row">
            <button
              id="project-persistence-delete-device-confirm"
              ref={deleteConfirmButtonRef}
              type="button"
              className="danger-button"
              disabled={busy || operation !== undefined}
              onClick={() => {
                void run("delete-device", () => onDeleteDevice(project)).then(
                  () => {
                    setDeleteConfirmation(false);
                  },
                );
              }}
            >
              端末保存の削除を確定
            </button>
            <button
              type="button"
              disabled={busy || operation !== undefined}
              onClick={() => {
                setDeleteConfirmation(false);
                setStatus("端末保存の削除をキャンセルしました。");
              }}
            >
              削除をやめる
            </button>
          </div>
        </div>
      ) : null}

      <p className="project-persistence__status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
      <aside className="project-persistence__notice">
        端末保存は1件だけです。明示的に削除するまで保持を試みますが、ブラウザのサイトデータ削除や容量管理で失われる場合があります。バックアップではありません。必要な時はJSONも書き出してください。操作履歴、未保存入力、選択、カメラ、判定結果は保存しません。
      </aside>
    </section>
  );
}
