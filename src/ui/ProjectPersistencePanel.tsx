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
import packageMetadata from "../../package.json";
import { CARGO_CREATION_LIMIT } from "../domain/input";
import { PROJECT_SCHEMA_VERSION, type Project } from "../domain/model";
import type { ContainerEditorIntent } from "./ContainerEditorDialog";
import {
  isProjectFileExportAvailable,
  isProjectFileImportAvailable,
} from "../persistence/project-file";
import { isProjectStoreAvailable } from "../persistence/project-store";
import {
  downloadCargoCsvTemplate,
  isCargoCsvFileImportAvailable,
  isCargoCsvTemplateDownloadAvailable,
} from "../persistence/cargo-csv-file";
import { OperationGuideDialog } from "./OperationGuideDialog";

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
  readonly onOpenCargoEditor: () => void;
  readonly onOpenCargoConstraints: () => void;
  readonly onOpenCargoCsv: (file: File) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onOpenProjectSettings: () => void;
  readonly onOpenUsageRequirements: () => void;
  readonly onOpenContainerEditor: (intent: ContainerEditorIntent) => void;
  readonly open: boolean;
  readonly project: Project;
  readonly selectedContainerId?: string;
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
    "全コンテナの物理判定を安全に再計算できないため読込を拒否しました。",
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
  onOpenCargoEditor,
  onOpenCargoConstraints,
  onOpenCargoCsv,
  onOpenChange,
  onOpenProjectSettings,
  onOpenUsageRequirements,
  onOpenContainerEditor,
  open: drawerOpen,
  project,
  selectedContainerId,
}: ProjectPersistencePanelProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [newProjectConfirmation, setNewProjectConfirmation] = useState(false);
  const [operationGuideOpen, setOperationGuideOpen] = useState(false);
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
  const returnScrollPositionRef = useRef({ left: 0, top: 0 });
  const interactionActive =
    drawerOpen ||
    deleteConfirmation ||
    newProjectConfirmation ||
    operationGuideOpen ||
    operation !== undefined;
  const deviceAvailable = isProjectStoreAvailable();
  const fileImportAvailable = isProjectFileImportAvailable();
  const fileExportAvailable = isProjectFileExportAvailable();
  const cargoCsvImportAvailable = isCargoCsvFileImportAvailable();
  const cargoCsvDownloadAvailable = isCargoCsvTemplateDownloadAvailable();
  const selectedContainer = project.containers.find(
    (container) => container.id === selectedContainerId,
  ) ?? project.containers[0];
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
      returnScrollPositionRef.current = { left: window.scrollX, top: window.scrollY };
      closeButtonRef.current?.focus({ preventScroll: true });
      window.scrollTo(
        returnScrollPositionRef.current.left,
        returnScrollPositionRef.current.top,
      );
      return;
    }
    if (!restoreEntryFocusRef.current) {
      return;
    }
    restoreEntryFocusRef.current = false;
    const returnScrollPosition = returnScrollPositionRef.current;
    document.getElementById("app-navigation-button")?.focus({ preventScroll: true });
    window.scrollTo(returnScrollPosition.left, returnScrollPosition.top);
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("app-navigation-button")?.focus({ preventScroll: true });
      window.scrollTo(returnScrollPosition.left, returnScrollPosition.top);
    });
    return () => window.cancelAnimationFrame(frame);
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
    restoreNewProjectFocusRef.current = false;
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

  const handleCargoCsvFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (file === undefined) return;
    finishDrawerAction(() => onOpenCargoCsv(file));
  };

  const handleCargoCsvTemplateDownload = () => {
    const result = downloadCargoCsvTemplate();
    publish(
      result.ok
        ? "積荷CSVテンプレートのダウンロードを開始しました。"
        : result.issue.code === "cargo-csv.download-unavailable"
          ? "このブラウザでは積荷CSVテンプレートをダウンロードできません。"
          : "積荷CSVテンプレートのダウンロードを開始できませんでした。",
      result.ok ? "success" : "failure",
    );
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
          onClick={(event) => {
            event.stopPropagation();
            closeDrawer();
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
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
            <h2 id="project-persistence-title" className="visually-hidden">CLPメニュー — 保存・再読込</h2>
            <button
              ref={closeButtonRef}
              className="project-persistence__close"
              type="button"
              aria-label="メニューを閉じる（CLPデータを閉じる）"
              onClick={closeDrawer}
            >
              メニューを閉じる
            </button>
          </div>

          <div className="project-persistence__groups">

            <div className="project-persistence__group">
              <h3>CLP</h3>
              <div className="project-persistence__button-grid project-persistence__button-grid--two">
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
                  新規
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => finishDrawerAction(onOpenProjectSettings)}
                >
                  設定
                </button>
              </div>
              <div className="project-persistence__button-stack">
                <button
                  id="cargo-add-button"
                  className="secondary-button"
                  type="button"
                  disabled={controlsDisabled || project.cargoes.length >= CARGO_CREATION_LIMIT}
                  onClick={() => finishDrawerAction(onOpenCargoEditor)}
                >
                  積荷追加
                </button>
                <button
                  id="cargo-constraints-button"
                  type="button"
                  disabled={controlsDisabled || project.cargoes.length === 0}
                  onClick={() => finishDrawerAction(onOpenCargoConstraints)}
                >
                  制約一括編集
                </button>
              </div>
            </div>
            <div className="project-persistence__group">
              <h3>積荷一括登録</h3>
              <p className="project-persistence__availability">
                テンプレートにまとめて入力し、一括登録します。
              </p>
              <div className="project-persistence__button-stack">
                <button
                  id="cargo-csv-template-download"
                  type="button"
                  disabled={controlsDisabled || !cargoCsvDownloadAvailable}
                  onClick={handleCargoCsvTemplateDownload}
                >
                  テンプレートダウンロード
                </button>
                <label
                  className="file-input-button"
                  aria-disabled={controlsDisabled || !cargoCsvImportAvailable}
                >
                  テンプレートインポート
                  <input
                    id="cargo-csv-file-input"
                    type="file"
                    accept=".csv,text/csv"
                    data-project-history-shortcuts="local"
                    disabled={controlsDisabled || !cargoCsvImportAvailable}
                    onChange={handleCargoCsvFile}
                  />
                </label>
              </div>
              {!cargoCsvImportAvailable || !cargoCsvDownloadAvailable ? (
                <p className="project-persistence__availability">
                  このブラウザでは積荷CSVの読込またはテンプレート取得の一部を利用できません。
                </p>
              ) : null}
            </div>
            <div className="project-persistence__group">
              <h3>コンテナ</h3>
              <p className="project-persistence__availability">
                {project.containers.length === 0
                  ? "コンテナはまだありません。"
                  : `選択中: ${selectedContainer?.name ?? "コンテナなし"} · ${project.containers.length} / 100件`}
              </p>
              <div className="project-persistence__button-grid project-persistence__button-grid--three">
                <button
                  id="container-add-button"
                  className="secondary-button"
                  type="button"
                  disabled={controlsDisabled || project.containers.length >= 100}
                  onClick={() => finishDrawerAction(() => onOpenContainerEditor({ kind: "add" }))}
                >
                  追加
                </button>
                <button
                  id="container-edit-button"
                  type="button"
                  disabled={controlsDisabled || project.containers.length === 0}
                  onClick={() => {
                    const container = selectedContainer;
                    if (container !== undefined) {
                      finishDrawerAction(() => onOpenContainerEditor({ kind: "edit", containerId: container.id }));
                    }
                  }}
                >
                  編集
                </button>
                <button
                  id="container-delete-button"
                  className="danger-button"
                  type="button"
                  disabled={controlsDisabled || project.containers.length === 0}
                  onClick={() => {
                    const container = selectedContainer;
                    if (container !== undefined) {
                      finishDrawerAction(() => onOpenContainerEditor({ kind: "delete", containerId: container.id }));
                    }
                  }}
                >
                  削除
                </button>
              </div>
            </div>
            <div className="project-persistence__group">
              <h3>保存</h3>
              <div className="project-persistence__button-grid project-persistence__button-grid--two">
                <button
                  type="button"
                  disabled={controlsDisabled || !deviceAvailable}
                  onClick={() => void run("save-device", () => onSaveDevice(project))}
                >
                  端末へ保存
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled || !fileExportAvailable}
                  onClick={() => void run("export-file", () => onExportFile(project))}
                >
                  JSONへ保存
                </button>
              </div>
              <div className="project-persistence__button-stack project-persistence__button-stack--secondary">
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
              {!deviceAvailable || !fileExportAvailable ? (
                <p className="project-persistence__availability">
                  このブラウザでは端末保存またはJSON保存の一部を利用できません。
                </p>
              ) : null}
              <section
                className="project-persistence__last-result"
                aria-labelledby="project-persistence-last-result-title"
              >
                <h4 id="project-persistence-last-result-title">直近の結果</h4>
                <p className="project-persistence__status">
                  {status === "" ? "まだ保存・再読込操作を行っていません。" : status}
                </p>
              </section>
              <aside className="project-persistence__notice">
                端末保存は1件だけです。明示的に削除するまで保持を試みますが、ブラウザのサイトデータ削除や容量管理で失われる場合があります。バックアップではありません。必要な時はJSONも書き出してください。操作履歴、未保存入力、選択、カメラ、判定結果は保存しません。
              </aside>
            </div>

            <div className="project-persistence__group">
              <h3>読込</h3>
              <div className="project-persistence__button-grid project-persistence__button-grid--two">
                <button
                  type="button"
                  disabled={controlsDisabled || !deviceAvailable}
                  onClick={() => void run("load-device", () => onLoadDevice(project))}
                >
                  端末から読込
                </button>
                <label
                  className="file-input-button"
                  aria-disabled={controlsDisabled || !fileImportAvailable}
                >
                  JSONから読込
                  <input
                    id="project-json-file-input"
                    type="file"
                    accept=".json,application/json"
                    data-project-history-shortcuts="local"
                    disabled={controlsDisabled || !fileImportAvailable}
                    onChange={handleFile}
                  />
                </label>
              </div>
              {!deviceAvailable || !fileImportAvailable ? (
                <p className="project-persistence__availability">
                  このブラウザでは端末またはJSONからの読込の一部を利用できません。
                </p>
              ) : null}
            </div>
            <div className="project-persistence__group">
              <h3>ヘルプ</h3>
              <div className="project-persistence__button-grid project-persistence__button-grid--two">
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => finishDrawerAction(() => setOperationGuideOpen(true))}
                >
                  操作方法
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => finishDrawerAction(onOpenUsageRequirements)}
                >
                  使用上の重要事項
                </button>
              </div>
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

          <footer className="project-persistence__version-info" aria-label="バージョン情報">
            <span>Auto CLP v{packageMetadata.version}</span>
            <span>CLPデータ形式 v{PROJECT_SCHEMA_VERSION}</span>
          </footer>
        </aside>
      </div>

      {operationGuideOpen ? (
        <OperationGuideDialog onClose={() => setOperationGuideOpen(false)} />
      ) : null}

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
