import { useCallback, useEffect, useState } from "react";

import type { ProjectHistoryAction } from "../application/project-history";

interface ProjectHistoryControlsProps {
  readonly busy: boolean;
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly commitRevision: number;
  readonly onRedo: () => boolean;
  readonly onUndo: () => boolean;
  readonly redoAction?: ProjectHistoryAction;
  readonly undoAction?: ProjectHistoryAction;
}

const actionCopy = {
  "project-settings.update": "案件設定の更新",
  "cargo.add": "積荷の追加",
  "cargo.update": "積荷の更新",
  "cargo.delete": "積荷の削除",
  "container.add": "候補の追加",
  "container.update": "候補の更新",
  "container.delete": "候補の削除",
  "placement.add": "配置の追加",
  "placement.update": "配置の更新",
  "placement.delete": "配置の削除",
  "placement.drag-xy": "3Dでの配置移動",
} satisfies Record<ProjectHistoryAction, string>;

interface HistoryAnnouncement {
  readonly commitRevision: number;
  readonly copy: string;
}

function shortcutProtectedElement(target: EventTarget): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return (
    target.matches("input, textarea, select") ||
    target.matches("[contenteditable]:not([contenteditable='false'])") ||
    (target instanceof HTMLElement && target.isContentEditable) ||
    target.matches("[data-project-history-shortcuts='local']") ||
    target.localName.includes("-")
  );
}

function shortcutProtectedContext(event: KeyboardEvent): boolean {
  if (event.composedPath().some(shortcutProtectedElement)) {
    return true;
  }
  const activeElement = document.activeElement;
  return activeElement !== null && shortcutProtectedElement(activeElement);
}

export function ProjectHistoryControls({
  busy,
  canRedo,
  canUndo,
  commitRevision,
  onRedo,
  onUndo,
  redoAction,
  undoAction,
}: ProjectHistoryControlsProps) {
  const [announcement, setAnnouncement] = useState<HistoryAnnouncement>();

  const run = useCallback(
    (direction: "undo" | "redo"): boolean => {
      if (busy) {
        return false;
      }
      const activeElement = document.activeElement;
      const changed = direction === "undo" ? onUndo() : onRedo();
      if (!changed) {
        return false;
      }
      setAnnouncement({
        commitRevision,
        copy:
          direction === "undo"
            ? "直前の操作を取り消しました。"
            : "取り消した操作をやり直しました。",
      });
      queueMicrotask(() => {
        if (activeElement instanceof HTMLElement && !activeElement.isConnected) {
          document
            .getElementById(
              direction === "undo" ? "project-history-undo" : "project-history-redo",
            )
            ?.focus();
        }
      });
      return true;
    },
    [busy, commitRevision, onRedo, onUndo],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        busy ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey === event.metaKey ||
        shortcutProtectedContext(event)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      let changed = false;
      if (key === "z") {
        changed = run(event.shiftKey ? "redo" : "undo");
      } else if (
        event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        key === "y"
      ) {
        changed = run("redo");
      }
      if (changed) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, run]);

  const nextActionSummary = busy
    ? "入力または3D操作を完了すると、履歴操作を利用できます。"
    : undoAction === undefined && redoAction === undefined
      ? "取り消し・やり直しできる案件操作はありません。"
      : [
          undoAction === undefined
            ? undefined
            : `次に元に戻せる操作: ${actionCopy[undoAction]}。`,
          redoAction === undefined
            ? undefined
            : `次にやり直せる操作: ${actionCopy[redoAction]}。`,
        ]
          .filter((copy): copy is string => copy !== undefined)
          .join(" ");
  const activeAnnouncement =
    announcement?.commitRevision === commitRevision ? announcement.copy : undefined;
  const summary =
    activeAnnouncement === undefined
      ? nextActionSummary
      : `${activeAnnouncement} ${nextActionSummary}`;

  return (
    <section className="project-history" aria-labelledby="project-history-title">
      <div className="project-history__heading">
        <div>
          <p className="eyebrow">PROJECT HISTORY</p>
          <h2 id="project-history-title">取り消し・やり直し</h2>
        </div>
        <div className="button-row">
          <button
            id="project-history-undo"
            type="button"
            disabled={busy || !canUndo}
            aria-keyshortcuts="Control+Z Meta+Z"
            aria-describedby={busy ? "project-history-busy" : undefined}
            onClick={() => run("undo")}
          >
            元に戻す
          </button>
          <button
            id="project-history-redo"
            type="button"
            disabled={busy || !canRedo}
            aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            aria-describedby={busy ? "project-history-busy" : undefined}
            onClick={() => run("redo")}
          >
            やり直す
          </button>
        </div>
      </div>
      <p className="project-history__summary" aria-live="polite" aria-atomic="true">
        {summary}
      </p>
      {busy ? (
        <p id="project-history-busy" className="project-history__busy">
          未保存入力、削除確認、または3D移動中は履歴を変更しません。
        </p>
      ) : null}
    </section>
  );
}
