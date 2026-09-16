import { useState } from "react";

import {
  updateCargoConstraints,
  type CargoConstraintDraft,
} from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import type { Project } from "../domain/model";
import { isUprightOnlyOrientationPolicy } from "../domain/orientation-policy";
import { ModalShell } from "./ModalShell";

export interface CargoConstraintsRequest {
  readonly key: number;
  readonly returnScrollPosition: { readonly left: number; readonly top: number };
}

interface CargoConstraintsDialogProps {
  readonly onClose: () => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly project: Project;
  readonly request: CargoConstraintsRequest;
}

function draftsFrom(project: Project): readonly CargoConstraintDraft[] {
  return project.cargoes.map((cargo) => ({
    cargoId: cargo.id,
    topLoadingProhibited: !cargo.canSupportCargo,
    uprightOnly: isUprightOnlyOrientationPolicy(cargo.allowedOrientations),
  }));
}

function sameDrafts(
  first: readonly CargoConstraintDraft[],
  second: readonly CargoConstraintDraft[],
): boolean {
  return first.every((draft, index) => {
    const other = second[index];
    return other !== undefined &&
      draft.cargoId === other.cargoId &&
      draft.topLoadingProhibited === other.topLoadingProhibited &&
      draft.uprightOnly === other.uprightOnly;
  });
}

export function CargoConstraintsDialog({
  onClose,
  onProjectCommit,
  project,
  request,
}: CargoConstraintsDialogProps) {
  const [drafts, setDrafts] = useState(() => draftsFrom(project));
  const [originalDrafts] = useState(drafts);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [status, setStatus] = useState("");
  const dirty = !sameDrafts(drafts, originalDrafts);

  const updateDraft = (
    cargoId: string,
    update: Partial<Pick<CargoConstraintDraft, "topLoadingProhibited" | "uprightOnly">>,
  ) => {
    setDrafts((current) => current.map((draft) =>
      draft.cargoId === cargoId ? { ...draft, ...update } : draft,
    ));
    setStatus("");
  };

  const requestClose = () => {
    if (confirmDiscard) {
      setConfirmDiscard(false);
      setStatus("編集を続けます。");
      return;
    }
    if (dirty) {
      setConfirmDiscard(true);
      setStatus("未保存の制約変更を破棄するか確認してください。");
      return;
    }
    onClose();
  };

  const submit = () => {
    const result = updateCargoConstraints(project, drafts);
    if (!result.ok) {
      setStatus(
        result.issues.some((issue) => issue.code === "semantic.disallowed-orientation")
          ? "横倒しで配置中の積荷は天地無用へ変更できません。先に立置きへ戻してください。"
          : "制約を更新できませんでした。現在のCLPを確認してください。",
      );
      return;
    }
    const transition = onProjectCommit({
      baseProject: project,
      nextProject: result.project,
      action: "cargo.constraints-update",
    });
    if (!transition.ok) {
      setStatus("CLPが更新されたため適用できませんでした。入力内容は保持しています。");
      return;
    }
    onClose();
  };

  return (
    <ModalShell
      fallbackFocusIds={["app-navigation-button", "scene-cargo-select"]}
      initialFocusId={drafts[0] === undefined ? "cargo-constraints-cancel" : `cargo-upright-${drafts[0].cargoId}`}
      returnScrollPosition={request.returnScrollPosition}
      title="積荷の制約を一覧編集"
      onRequestClose={requestClose}
    >
      <p>チェックした制約を「変更を適用」でまとめて更新します。名前・寸法・重量と配置は変更しません。</p>
      <p className="field-help">上乗せ禁止は、この積荷の上に別の積荷を載せない設定です。制約に合わない現在の配置は自動で移動せず、不適合として表示します。</p>
      <p className="action-status" role={status === "" ? undefined : "alert"} aria-live="polite">{status}</p>

      {confirmDiscard ? (
        <div className="confirm-panel" role="alert">
          <p>未保存の制約変更を破棄して閉じますか。</p>
          <div className="button-row">
            <button className="danger-button" type="button" onClick={onClose}>変更を破棄して閉じる</button>
            <button type="button" onClick={() => setConfirmDiscard(false)}>編集を続ける</button>
          </div>
        </div>
      ) : null}

      <div className="cargo-constraints-list" role="group" aria-label="積荷ごとの制約">
        {project.cargoes.map((cargo, index) => {
          const draft = drafts[index]!;
          return (
            <fieldset className="cargo-constraints-row" key={cargo.id}>
              <legend>{cargo.name}</legend>
              <label className="check-row">
                <input
                  id={`cargo-upright-${cargo.id}`}
                  type="checkbox"
                  checked={draft.uprightOnly}
                  onChange={(event) => updateDraft(cargo.id, { uprightOnly: event.target.checked })}
                />
                <span>天地無用</span>
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={draft.topLoadingProhibited}
                  onChange={(event) => updateDraft(cargo.id, { topLoadingProhibited: event.target.checked })}
                />
                <span>上乗せ禁止</span>
              </label>
            </fieldset>
          );
        })}
      </div>

      <div className="button-row modal-shell__actions">
        <button className="primary-button" type="button" disabled={!dirty} onClick={submit}>変更を適用</button>
        <button id="cargo-constraints-cancel" type="button" onClick={requestClose}>キャンセル</button>
      </div>
    </ModalShell>
  );
}
