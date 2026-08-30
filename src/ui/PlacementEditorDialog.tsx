import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type FormEvent,
} from "react";

import {
  addPlacement,
  deletePlacement,
  updatePlacement,
  type PlacementDraft,
} from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import type { Orientation, Placement, Project } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";
import { ModalShell } from "./ModalShell";
import { placementOrientationOptionCopy } from "./placement-presentation";

export interface PlacementEditorDialogHandle {
  readonly openCoordinatesForCargo: (cargoId: string) => boolean;
  readonly openDeleteForCargo: (cargoId: string) => boolean;
}

interface PlacementEditorDialogProps {
  readonly externalInteractionActive: boolean;
  readonly historyRevision: number;
  readonly onInteractionChange: (active: boolean) => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly onSelectedCargoChange: (cargoId?: string) => void;
  readonly onStatusChange: (status: string) => void;
  readonly project: Project;
  readonly selectedContainerId?: string;
}

type Editor = {
  readonly cargoId: string;
  readonly containerId: string;
  readonly kind: "new" | "edit";
  readonly returnScrollPosition: { readonly left: number; readonly top: number };
};
type DeleteTarget = {
  readonly cargoId: string;
  readonly containerId: string;
  readonly returnScrollPosition: { readonly left: number; readonly top: number };
};

function draftFromPlacement(placement: Placement): PlacementDraft {
  return {
    xMm: String(placement.positionMm.xMm),
    yMm: String(placement.positionMm.yMm),
    zMm: String(placement.positionMm.zMm),
    orientation: placement.orientation,
  };
}

function issueMessage(issue: ValidationIssue): string {
  const messages: Record<string, string> = {
    "input.mm-format": "座標は半角整数で入力してください。",
    "input.mm-length": "座標の入力桁数が上限を超えています。",
    "input.mm-range": "座標は-1,000,000〜1,000,000 mmで入力してください。",
    "semantic.disallowed-orientation": "この積荷で許可されている向きを選択してください。",
    "command.cargo-already-placed": "この積荷はすでに配置されています。",
    "command.cargo-not-found": "対象の積荷が見つかりません。",
    "command.container-not-found": "選択した候補が見つかりません。",
    "command.placement-not-found": "対象の配置が見つかりません。",
  };
  return messages[issue.code] ?? "配置内容を確認してください。";
}

function PositionField({
  axis,
  draft,
  issues,
  onChange,
}: {
  readonly axis: "xMm" | "yMm" | "zMm";
  readonly draft: PlacementDraft;
  readonly issues: readonly ValidationIssue[];
  readonly onChange: (draft: PlacementDraft) => void;
}) {
  const id = `placement-${axis}`;
  const issue = issues.find((candidate) => candidate.path.endsWith(`/${axis}`));
  return (
    <div className="field">
      <label htmlFor={id}>{axis[0]!.toUpperCase()}最小角</label>
      <div className="field__control">
        <input
          id={id}
          value={draft[axis]}
          inputMode="text"
          maxLength={9}
          aria-invalid={issue === undefined ? undefined : true}
          aria-describedby={issue === undefined ? undefined : `${id}-error`}
          onChange={(event) => onChange({ ...draft, [axis]: event.target.value })}
        />
        <span className="field__unit">mm</span>
      </div>
      {issue === undefined ? null : (
        <span id={`${id}-error`} className="field__error">エラー: {issueMessage(issue)}</span>
      )}
    </div>
  );
}

export const PlacementEditorDialog = forwardRef<
  PlacementEditorDialogHandle,
  PlacementEditorDialogProps
>(function PlacementEditorDialog(
  {
    externalInteractionActive,
    historyRevision,
    onInteractionChange,
    onProjectCommit,
    onSelectedCargoChange,
    onStatusChange,
    project,
    selectedContainerId,
  },
  ref,
) {
  const [editor, setEditor] = useState<Editor>();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>();
  const [draft, setDraft] = useState<PlacementDraft>();
  const [originalDraft, setOriginalDraft] = useState<PlacementDraft>();
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const interactionActive = editor !== undefined || deleteTarget !== undefined;
  const dirty =
    draft !== undefined &&
    originalDraft !== undefined &&
    JSON.stringify(draft) !== JSON.stringify(originalDraft);

  const close = () => {
    setEditor(undefined);
    setDeleteTarget(undefined);
    setDraft(undefined);
    setOriginalDraft(undefined);
    setIssues([]);
    setConfirmDiscard(false);
    onInteractionChange(false);
  };

  useEffect(() => {
    if (!interactionActive) return;
    queueMicrotask(() => {
      close();
      onStatusChange("履歴移動により開いていた配置ダイアログを閉じました。");
    });
    // historyRevision is the barrier; the other dependencies are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyRevision]);

  const beginCoordinates = (cargoId: string): boolean => {
    if (externalInteractionActive || interactionActive || selectedContainerId === undefined) {
      return false;
    }
    const cargo = project.cargoes.find((candidate) => candidate.id === cargoId);
    if (cargo === undefined) return false;
    const placement = project.placements.find(
      (candidate) =>
        candidate.cargoId === cargoId &&
        candidate.containerId === selectedContainerId,
    );
    if (placement === undefined && project.placements.some((candidate) => candidate.cargoId === cargoId)) {
      return false;
    }
    const nextDraft = placement === undefined
      ? {
          xMm: "0",
          yMm: "0",
          zMm: "0",
          orientation: cargo.allowedOrientations[0]!,
        }
      : draftFromPlacement(placement);
    setEditor({
      cargoId,
      containerId: selectedContainerId,
      kind: placement === undefined ? "new" : "edit",
      returnScrollPosition: { left: window.scrollX, top: window.scrollY },
    });
    setDraft(nextDraft);
    setOriginalDraft(nextDraft);
    setIssues([]);
    onInteractionChange(true);
    return true;
  };

  const beginDelete = (cargoId: string): boolean => {
    if (externalInteractionActive || interactionActive || selectedContainerId === undefined) {
      return false;
    }
    const placement = project.placements.find(
      (candidate) =>
        candidate.cargoId === cargoId &&
        candidate.containerId === selectedContainerId,
    );
    if (placement === undefined) return false;
    setDeleteTarget({
      cargoId,
      containerId: selectedContainerId,
      returnScrollPosition: { left: window.scrollX, top: window.scrollY },
    });
    setIssues([]);
    onInteractionChange(true);
    return true;
  };

  useImperativeHandle(ref, () => ({
    openCoordinatesForCargo: beginCoordinates,
    openDeleteForCargo: beginDelete,
  }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (editor === undefined || draft === undefined) return;
    const result = editor.kind === "new"
      ? addPlacement(project, editor.cargoId, editor.containerId, draft)
      : updatePlacement(project, editor.cargoId, editor.containerId, draft);
    if (!result.ok) {
      setIssues(result.issues);
      queueMicrotask(() => document.getElementById("placement-dialog-errors")?.focus({ preventScroll: true }));
      return;
    }
    const transition = onProjectCommit({
      baseProject: project,
      nextProject: result.project,
      action: editor.kind === "new" ? "placement.add" : "placement.update",
    });
    if (!transition.ok) {
      onStatusChange("CLPが更新されたため配置を保存できませんでした。入力内容は保持しています。");
      return;
    }
    onSelectedCargoChange(editor.cargoId);
    onStatusChange(
      editor.kind === "new"
        ? "座標で配置し、物理判定を再計算しています。"
        : "配置を保存し、物理判定を再計算しています。",
    );
    close();
  };

  const removePlacement = () => {
    if (deleteTarget === undefined) return;
    const cargo = project.cargoes.find((candidate) => candidate.id === deleteTarget.cargoId);
    const result = deletePlacement(project, deleteTarget.cargoId, deleteTarget.containerId);
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    const transition = onProjectCommit({
      baseProject: project,
      nextProject: result.project,
      action: "placement.delete",
    });
    if (!transition.ok) {
      onStatusChange("CLPが更新されたため配置を解除できませんでした。");
      return;
    }
    onSelectedCargoChange(deleteTarget.cargoId);
    onStatusChange(`${cargo?.name ?? "積荷"}を荷室から外しました。積荷情報は残っています。`);
    close();
  };

  if (editor !== undefined && draft !== undefined) {
    const cargo = project.cargoes.find((candidate) => candidate.id === editor.cargoId);
    const orientationIssue = issues.find((issue) => issue.path.endsWith("/orientation"));
    return (
      <ModalShell
        fallbackFocusIds={["scene-selection-coordinate-action", "scene-cargo-select", "cargo-add-button"]}
        title={cargo?.name ?? "配置を編集"}
        initialFocusId="placement-xMm"
        returnScrollPosition={editor.returnScrollPosition}
        onRequestClose={() => {
          if (confirmDiscard) setConfirmDiscard(false);
          else if (dirty) setConfirmDiscard(true);
          else close();
        }}
      >
        {issues.length === 0 ? null : (
          <div id="placement-dialog-errors" className="error-summary" role="alert" tabIndex={-1}>
            <strong>配置を保存できませんでした</strong>
            <ul>{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issueMessage(issue)}</li>)}</ul>
          </div>
        )}
        {confirmDiscard ? (
          <div className="confirm-panel" role="alert">
            <p>未保存の座標入力を破棄して閉じますか。</p>
            <div className="button-row">
              <button className="danger-button" type="button" onClick={close}>入力を破棄して閉じる</button>
              <button type="button" onClick={() => setConfirmDiscard(false)}>編集を続ける</button>
            </div>
          </div>
        ) : null}
        <form className="placement-form" onSubmit={submit} noValidate>
          <p className="field-help warning-copy">
            境界外の座標も修正途中の配置として保存し、保存後に物理判定で不適合を表示します。
          </p>
          <div className="placement-coordinate-grid">
            <PositionField axis="xMm" draft={draft} issues={issues} onChange={setDraft} />
            <PositionField axis="yMm" draft={draft} issues={issues} onChange={setDraft} />
            <PositionField axis="zMm" draft={draft} issues={issues} onChange={setDraft} />
          </div>
          <div className="placement-orientation-field">
            <label htmlFor="placement-orientation">向き</label>
            <select
              id="placement-orientation"
              value={draft.orientation}
              aria-invalid={orientationIssue === undefined ? undefined : true}
              onChange={(event) => setDraft({ ...draft, orientation: event.target.value as Orientation })}
            >
              {cargo?.allowedOrientations.map((orientation) => (
                <option key={orientation} value={orientation}>
                  {placementOrientationOptionCopy(cargo, orientation)}
                </option>
              ))}
            </select>
          </div>
          <div className="button-row modal-shell__actions">
            <button className="primary-button" type="submit">配置を保存</button>
            <button type="button" onClick={() => dirty ? setConfirmDiscard(true) : close()}>キャンセル</button>
          </div>
        </form>
      </ModalShell>
    );
  }

  if (deleteTarget !== undefined) {
    const cargo = project.cargoes.find((candidate) => candidate.id === deleteTarget.cargoId);
    const container = project.containers.find((candidate) => candidate.id === deleteTarget.containerId);
    return (
      <ModalShell
        fallbackFocusIds={["scene-selection-coordinate-action", "scene-cargo-select", "cargo-add-button"]}
        returnScrollPosition={deleteTarget.returnScrollPosition}
        title="荷室から外す"
        onRequestClose={close}
      >
        <div className="confirm-panel" role="alert">
          <p>{cargo?.name ?? "積荷"}を{container?.name ?? "現在の候補"}の荷室から外します。積荷情報は残ります。</p>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={removePlacement}>荷室から外す</button>
            <button type="button" onClick={close}>キャンセル</button>
          </div>
        </div>
      </ModalShell>
    );
  }

  return null;
});
