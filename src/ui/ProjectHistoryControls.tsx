import { useCallback, useEffect, useState } from "react";

import type { ProjectHistoryAction } from "../application/project-history";

export interface ProjectHistoryControlsProps {
  readonly busy: boolean;
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly commitRevision: number;
  readonly onRedo: () => boolean;
  readonly onUndo: () => boolean;
  readonly redoAction?: ProjectHistoryAction;
  readonly undoAction?: ProjectHistoryAction;
  readonly compact?: boolean;
}

const actionCopy = {
  "project-settings.update": "CLP設定の更新",
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
  "automatic-proposal.apply": "自動提案の一括適用",
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
  compact = false,
}: ProjectHistoryControlsProps) {
  const [announcement, setAnnouncement] = useState<HistoryAnnouncement>();

  const run = useCallback(
    (direction: "undo" | "redo"): boolean => {
      if (busy) {
        return false;
      }
      const activeElement = document.activeElement;
      const scrollPosition = { x: window.scrollX, y: window.scrollY };
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
      const restoreScrollPosition = () => {
        window.scrollTo(scrollPosition.x, scrollPosition.y);
      };
      queueMicrotask(() => {
        restoreScrollPosition();
        if (activeElement instanceof HTMLElement && !activeElement.isConnected) {
          document
            .getElementById(
              direction === "undo" ? "project-history-undo" : "project-history-redo",
            )
            ?.focus({ preventScroll: true });
        }
      });
      requestAnimationFrame(() => {
        restoreScrollPosition();
        requestAnimationFrame(() => {
          restoreScrollPosition();
          requestAnimationFrame(restoreScrollPosition);
        });
      });
      window.setTimeout(restoreScrollPosition, 120);
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
      ? "取り消し・やり直しできるCLP操作はありません。"
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

  if (compact) {
    return (
      <section
        className="project-history project-history--compact"
        role="group"
        aria-label="CLP全体の履歴"
      >
        <button
          id="project-history-undo"
          type="button"
          disabled={busy || !canUndo}
          aria-label="元に戻す"
          aria-keyshortcuts="Control+Z Meta+Z"
          aria-describedby={busy ? "project-history-busy" : undefined}
          onClick={() => run("undo")}
        >
          <span aria-hidden="true">↶</span>
        </button>
        <button
          id="project-history-redo"
          type="button"
          disabled={busy || !canRedo}
          aria-label="やり直す"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          aria-describedby={busy ? "project-history-busy" : undefined}
          onClick={() => run("redo")}
        >
          <span aria-hidden="true">↷</span>
        </button>
        <p className="project-history__summary visually-hidden" aria-live="polite" aria-atomic="true">
          {summary}
        </p>
        <p
          id="project-history-busy"
          className="project-history__busy visually-hidden"
          data-active={busy ? "true" : "false"}
          aria-hidden={busy ? undefined : true}
        >
          {busy
            ? "未保存入力、削除確認、または3D移動中は履歴を変更しません。"
            : "CLP操作の履歴は現在利用できます。"}
        </p>
      </section>
    );
  }

  return (
    <section className="project-history" aria-labelledby="project-history-title">
      <div className="project-history__heading">
        <div>
          <p className="eyebrow">CLP-WIDE HISTORY</p>
          <h4 id="project-history-title">CLP全体の操作</h4>
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
      <p
        id="project-history-busy"
        className="project-history__busy"
        data-active={busy ? "true" : "false"}
        aria-hidden={busy ? undefined : true}
      >
        {busy
          ? "未保存入力、削除確認、または3D移動中は履歴を変更しません。"
          : "CLP操作の履歴は現在利用できます。"}
      </p>
    </section>
  );
}
