import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

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

type NotificationKind = "processing" | "success" | "cancel" | "failure";

interface PersistenceNotification {
  readonly id: number;
  readonly kind: NotificationKind;
  readonly message: string;
}

interface ProjectPersistencePanelProps {
  readonly busy: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly onCreateNewProject: () => void;
  readonly onDeleteDevice: (baseProject: Project) => Promise<ProjectPersistenceActionResult>;
  readonly onExportFile: (baseProject: Project) => Promise<ProjectPersistenceActionResult>;
  readonly onImportFile: (
    baseProject: Project,
    file: File,
  ) => Promise<ProjectPersistenceActionResult>;
  readonly onInteractionChange: (active: boolean) => void;
  readonly onLoadDevice: (baseProject: Project) => Promise<ProjectPersistenceActionResult>;
  readonly onSaveDevice: (baseProject: Project) => Promise<ProjectPersistenceActionResult>;
  readonly onOpenChange: (open: boolean) => void;
  readonly onOpenProjectSettings: () => void;
  readonly open: boolean;
  readonly project: Project;
}

const failureCopy = {
  "persistence.operation-busy":
    "未保存入力、削除確認、3D移動、または別の保存操作を完了してからやり直してください。",
  "persistence.stale-base":
    "操作中にCLPが更新されたため処理を完了しませんでした。現在のCLPは変更していません。",
  "persistence.unexpected-failure":
    "保存処理で予期しない問題が発生しました。現在のCLPは変更していません。",
  "persistence.serialize-failed":
    "CLPを書き出し用データへ変換できませんでした。現在のCLPは変更していません。",
  "persistence.serialize-invalid":
    "現在のCLPが保存データ契約に適合しないため保存できませんでした。",
  "persistence.serialize-size-exceeded":
    "CLPデータが5 MiBの保存上限を超えるため保存できませんでした。",
  "persistence.import-size-invalid":
    "読込データのサイズを安全に確認できないため拒否しました。",
  "persistence.import-size-exceeded":
    "読込データが5 MiBの上限を超えるため拒否しました。",
  "persistence.import-read-failed":
    "データを読み取れませんでした。現在のCLPは変更していません。",
  "persistence.import-syntax-invalid":
    "JSONの形式が正しくないため拒否しました。現在のCLPは変更していません。",
  "persistence.import-version-unsupported":
    "対応していないCLPデータ版のため拒否しました。",
  "persistence.import-schema-invalid":
    "CLPデータの構造または値域が契約に適合しないため拒否しました。",
  "persistence.import-semantic-invalid":
    "CLPデータのID、参照、向き、開口、または重量整合性を確認できないため拒否しました。",
  "persistence.import-preflight-failed":
    "全候補の物理判定を安全に再計算できないため読込を拒否しました。",
  "persistence.device-unavailable":
    "このブラウザでは端末内保存を利用できません。JSON書き出しを利用してください。",
  "persistence.device-open-failed":
    "端末内保存領域を開けませんでした。現在のCLPは変更していません。",
  "persistence.device-read-failed":
    "端末内保存を読み取れませんでした。現在のCLPは変更していません。",
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
  "save-device": "現在のCLPをこの端末へ保存しました。",
  "load-device":
    "端末内保存を読み込みました。以前の操作履歴は破棄し、物理判定を再計算しています。",
  "delete-device": "端末内の保存コピーを削除しました。",
  "export-file": "検証済みCLP JSONのダウンロードを開始しました。",
  "import-file":
    "CLP JSONを読み込みました。以前の操作履歴は破棄し、物理判定を再計算しています。",
} satisfies Record<PersistenceAction, string>;

const processingCopy =
  "処理中です。完了するまでCLPを閉じたり再読み込みしたりしないでください。";
const deleteCancelCopy = "端末保存の削除をキャンセルしました。";
const transientNotificationDurationMs = 6_000;
const modalFocusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function ProjectPersistencePanel({
  busy,
  hasUnsavedChanges,
  onCreateNewProject,
  onDeleteDevice,
  onExportFile,
  onImportFile,
  onInteractionChange,
  onLoadDevice,
  onSaveDevice,
  onOpenChange,
  onOpenProjectSettings,
  open: drawerOpen,
  project,
}: ProjectPersistencePanelProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [newProjectConfirmation, setNewProjectConfirmation] = useState(false);
  const [operation, setOperation] = useState<PersistenceAction>();
  const [status, setStatus] = useState("");
  const [notification, setNotification] = useState<PersistenceNotification>();
  const busyRef = useRef(busy);
  const drawerOpenRef = useRef(false);
  const deleteConfirmationRef = useRef(false);
  const operationRef = useRef(false);
  const notificationIdRef = useRef(0);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const deleteConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const newProjectButtonRef = useRef<HTMLButtonElement>(null);
  const newProjectConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const restoreEntryFocusRef = useRef(false);
  const restoreDeleteFocusRef = useRef(false);
  const restoreNewProjectFocusRef = useRef(false);
  const interactionActive = drawerOpen || deleteConfirmation || newProjectConfirmation || operation !== undefined;
  const deviceAvailable = isProjectStoreAvailable();
  const fileImportAvailable = isProjectFileImportAvailable();
  const fileExportAvailable = isProjectFileExportAvailable();
  const controlsDisabled = busy || operation !== undefined || deleteConfirmation || newProjectConfirmation;

  const publish = useCallback((message: string, kind: NotificationKind) => {
    notificationIdRef.current += 1;
    setStatus(message);
    setNotification({ id: notificationIdRef.current, kind, message });
  }, []);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
    if (drawerOpen) {
      closeButtonRef.current?.focus();
      return;
    }
    if (!restoreEntryFocusRef.current) {
      return;
    }
    restoreEntryFocusRef.current = false;
    document.getElementById("app-navigation-button")?.focus();
  }, [drawerOpen]);

  useEffect(() => {
    deleteConfirmationRef.current = deleteConfirmation;
    if (deleteConfirmation) {
      deleteConfirmButtonRef.current?.focus();
      return;
    }
    if (!restoreDeleteFocusRef.current || !drawerOpenRef.current) {
      restoreDeleteFocusRef.current = false;
      return;
    }
    restoreDeleteFocusRef.current = false;
    deleteButtonRef.current?.focus();
  }, [deleteConfirmation]);

  useEffect(() => {
    if (newProjectConfirmation) {
      newProjectConfirmButtonRef.current?.focus();
      return;
    }
    if (restoreNewProjectFocusRef.current && drawerOpenRef.current) {
      restoreNewProjectFocusRef.current = false;
      newProjectButtonRef.current?.focus();
    }
  }, [newProjectConfirmation]);

  useEffect(() => {
    onInteractionChange(interactionActive);
    return () => onInteractionChange(false);
  }, [interactionActive, onInteractionChange]);

  useEffect(() => {
    if (
      notification === undefined ||
      (notification.kind !== "success" && notification.kind !== "cancel")
    ) {
      return;
    }
    const notificationId = notification.id;
    const timer = window.setTimeout(() => {
      setNotification((current) =>
        current?.id === notificationId ? undefined : current,
      );
    }, transientNotificationDurationMs);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const cancelDeleteConfirmation = useCallback(
    (restoreDeleteFocus: boolean) => {
      if (!deleteConfirmationRef.current) {
        return;
      }
      deleteConfirmationRef.current = false;
      restoreDeleteFocusRef.current = restoreDeleteFocus;
      setDeleteConfirmation(false);
      publish(deleteCancelCopy, "cancel");
    },
    [publish],
  );

  const closeDrawer = useCallback(() => {
    if (deleteConfirmationRef.current && !operationRef.current) {
      cancelDeleteConfirmation(false);
    }
    setNewProjectConfirmation(false);
    drawerOpenRef.current = false;
    restoreEntryFocusRef.current = true;
    onOpenChange(false);
  }, [cancelDeleteConfirmation, onOpenChange]);

  const finishDrawerAction = useCallback((action: () => void) => {
    restoreNewProjectFocusRef.current = false;
    setNewProjectConfirmation(false);
    drawerOpenRef.current = false;
    restoreEntryFocusRef.current = false;
    onOpenChange(false);
    window.requestAnimationFrame(action);
  }, [onOpenChange]);

  const handleDrawerKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }
      const drawer = drawerRef.current;
      if (drawer === null) {
        return;
      }
      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(modalFocusableSelector),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const activeElement = document.activeElement;
      const activeIndex = focusable.findIndex((element) => element === activeElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        focusable.at(-1)?.focus();
      } else if (!event.shiftKey && activeIndex === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      } else if (activeIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? focusable.at(-1) : focusable[0])?.focus();
      }
    },
    [closeDrawer],
  );

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const stopBackgroundShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const historyShortcut =
        (event.ctrlKey || event.metaKey) && (key === "z" || key === "y");
      if (event.key !== "Escape" && !historyShortcut) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        closeDrawer();
      }
    };
    window.addEventListener("keydown", stopBackgroundShortcut, true);
    return () => window.removeEventListener("keydown", stopBackgroundShortcut, true);
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    const keepFocusInDrawer = (event: FocusEvent) => {
      const drawer = drawerRef.current;
      if (drawer !== null && !drawer.contains(event.target as Node)) {
        closeButtonRef.current?.focus();
      }
    };
    document.addEventListener("focusin", keepFocusInDrawer, true);
    return () => document.removeEventListener("focusin", keepFocusInDrawer, true);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || !controlsDisabled) {
      return;
    }
    const drawer = drawerRef.current;
    const activeElement = document.activeElement;
    if (
      drawer === null ||
      activeElement === null ||
      !drawer.contains(activeElement) ||
      (activeElement instanceof HTMLButtonElement && activeElement.disabled) ||
      (activeElement instanceof HTMLInputElement && activeElement.disabled)
    ) {
      closeButtonRef.current?.focus();
    }
  }, [controlsDisabled, drawerOpen]);

  const run = async (
    action: PersistenceAction,
    execute: () => Promise<ProjectPersistenceActionResult>,
  ): Promise<boolean> => {
    if (operationRef.current) {
      publish(failureCopy["persistence.operation-busy"], "failure");
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
      publish(failureCopy["persistence.operation-busy"], "failure");
      return false;
    }
    setOperation(action);
    publish(processingCopy, "processing");
    let result: ProjectPersistenceActionResult;
    try {
      result = await execute();
    } catch {
      result = { ok: false, code: "persistence.unexpected-failure" };
    } finally {
      operationRef.current = false;
      setOperation(undefined);
    }
    publish(
      result.ok ? successCopy[action] : failureCopy[result.code],
      result.ok ? "success" : "failure",
    );
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

  return (
    <>
      <div
        className="project-persistence__modal-layer"
        hidden={!drawerOpen}
      >
        <div
          className="project-persistence__backdrop"
          aria-hidden="true"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
        <aside
          id="project-persistence-drawer"
          ref={drawerRef}
          className="project-persistence"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-persistence-title"
          aria-busy={operation !== undefined}
          tabIndex={-1}
          onKeyDownCapture={handleDrawerKeyDownCapture}
        >
          <div className="project-persistence__heading">
            <div>
              <p className="eyebrow">LOCAL PERSISTENCE</p>
              <h2 id="project-persistence-title">CLPメニュー — 保存・再読込</h2>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="メニューを閉じる（CLPデータを閉じる）"
              onClick={closeDrawer}
            >
              メニューを閉じる
            </button>
          </div>
          <p className="project-persistence__manual-copy">
            自動保存・自動読込は行いません。
          </p>

          <div className="project-persistence__groups">

            <div className="project-persistence__group">
              <h3>CLP</h3>
              <div className="button-row">
                <button
                  id="project-persistence-new-project"
                  ref={newProjectButtonRef}
                  className="primary-button"
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      restoreNewProjectFocusRef.current = true;
                      setNewProjectConfirmation(true);
                      setStatus("未保存の変更を破棄して新規CLPを作成するか確認してください。");
                      return;
                    }
                    finishDrawerAction(onCreateNewProject);
                  }}
                >
                  新規CLP
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => finishDrawerAction(onOpenProjectSettings)}
                >
                  CLP設定
                </button>
              </div>
            </div>
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
                    deleteConfirmationRef.current = true;
                    restoreDeleteFocusRef.current = true;
                    setNotification(undefined);
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
                <label
                  className="file-input-button"
                  aria-disabled={controlsDisabled || !fileImportAvailable}
                >
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
                このブラウザの手動保存スロットを削除します。現在画面にあるCLPとJSONファイルは削除しません。
              </p>
              <div className="button-row">
                <button
                  id="project-persistence-delete-device-confirm"
                  ref={deleteConfirmButtonRef}
                  type="button"
                  className="danger-button"
                  disabled={busy || operation !== undefined}
                  onClick={() => {
                    void run("delete-device", () => onDeleteDevice(project)).then(() => {
                      deleteConfirmationRef.current = false;
                      restoreDeleteFocusRef.current = drawerOpenRef.current;
                      setDeleteConfirmation(false);
                    });
                  }}
                >
                  端末保存の削除を確定
                </button>
                <button
                  type="button"
                  disabled={busy || operation !== undefined}
                  onClick={() => cancelDeleteConfirmation(true)}
                >
                  削除をやめる
                </button>
              </div>
            </div>
          ) : null}

          {newProjectConfirmation ? (
            <div className="confirm-panel" role="alert">
              <p>
                現在のCLPに未保存の変更があります。新規CLPを作成すると、現在のCLPと操作履歴をこの画面から破棄します。必要なら先に端末保存またはJSON書き出しを行ってください。
              </p>
              <div className="button-row">
                <button
                  id="project-persistence-new-project-confirm"
                  ref={newProjectConfirmButtonRef}
                  className="danger-button"
                  type="button"
                  onClick={() => finishDrawerAction(onCreateNewProject)}
                >
                  破棄して新規CLPを作成
                </button>
                <button type="button" onClick={() => {
                  restoreNewProjectFocusRef.current = true;
                  setNewProjectConfirmation(false);
                }}>
                  現在のCLPへ戻る
                </button>
              </div>
            </div>
          ) : null}

          <section
            className="project-persistence__last-result"
            aria-labelledby="project-persistence-last-result-title"
          >
            <h3 id="project-persistence-last-result-title">直近の結果</h3>
            <p className="project-persistence__status">
              {status === "" ? "まだ保存・再読込操作を行っていません。" : status}
            </p>
          </section>
          <aside className="project-persistence__notice">
            端末保存は1件だけです。明示的に削除するまで保持を試みますが、ブラウザのサイトデータ削除や容量管理で失われる場合があります。バックアップではありません。必要な時はJSONも書き出してください。操作履歴、未保存入力、選択、カメラ、判定結果は保存しません。
          </aside>
        </aside>
      </div>

      {notification === undefined || drawerOpen ? null : (
        <div
          key={notification.id}
          className="project-persistence__snackbar"
          data-kind={notification.kind}
          data-notification-id={notification.id}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{notification.message}</span>
          {notification.kind === "failure" ? (
            <button
              type="button"
              aria-label="保存通知を閉じる"
              onClick={() => setNotification(undefined)}
            >
              閉じる
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
