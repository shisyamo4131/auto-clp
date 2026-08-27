import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  addPlacement,
  deletePlacement,
  updatePlacement,
  type PlacementDraft,
  type ProjectCommandResult,
} from "../application/project-command";
import type { Orientation, Placement, Project } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";

interface PlacementPanelProps {
  readonly onInteractionChange: (active: boolean) => void;
  readonly onProjectChange: (project: Project) => void;
  readonly project: Project;
  readonly selectedContainerId?: string;
}

interface PlacementTarget {
  readonly cargoId: string;
  readonly containerId: string;
}

type PlacementEditor = PlacementTarget &
  ({ readonly kind: "new" } | { readonly kind: "edit" });

const ORIENTATION_COPY: Record<Orientation, string> = {
  LWH: "X=長さ・Y=幅・Z=高さ",
  WLH: "X=幅・Y=長さ・Z=高さ",
  LHW: "X=長さ・Y=高さ・Z=幅",
  HLW: "X=高さ・Y=長さ・Z=幅",
  WHL: "X=幅・Y=高さ・Z=長さ",
  HWL: "X=高さ・Y=幅・Z=長さ",
};

function draftFromPlacement(placement: Placement): PlacementDraft {
  return {
    xMm: String(placement.positionMm.xMm),
    yMm: String(placement.positionMm.yMm),
    zMm: String(placement.positionMm.zMm),
    orientation: placement.orientation,
  };
}

function placementIssueMessage(issue: ValidationIssue): string {
  const messages: Record<string, string> = {
    "input.mm-format": "座標は半角数字の整数で入力し、負値は先頭に-を付けてください。",
    "input.mm-length": "座標の入力桁数が上限を超えています。",
    "input.mm-range": "座標は-1,000,000〜1,000,000 mmで入力してください。",
    "semantic.disallowed-orientation": "この積荷で許可されている向きを選択してください。",
    "command.cargo-already-placed": "この積荷はすでに別の候補を含む配置で使用されています。",
    "command.cargo-not-found": "対象の積荷が見つかりません。",
    "command.container-not-found": "選択した候補が見つかりません。",
    "command.placement-not-found": "対象の配置が見つかりません。",
  };
  return messages[issue.code] ?? "配置内容を確認してください。";
}

function focusElement(id: string): void {
  queueMicrotask(() => document.getElementById(id)?.focus());
}

function focusPreferredOrPanel(preferredId?: string): void {
  queueMicrotask(() => {
    const preferred =
      preferredId === undefined ? null : document.getElementById(preferredId);
    (preferred ?? document.getElementById("placement-panel-title"))?.focus();
  });
}

function issueFor(
  issues: readonly ValidationIssue[],
  field: "xMm" | "yMm" | "zMm" | "orientation",
): ValidationIssue | undefined {
  return issues.find((issue) => issue.path.endsWith(`/${field}`));
}

function PositionField({
  axis,
  issues,
  onChange,
  value,
}: {
  readonly axis: "xMm" | "yMm" | "zMm";
  readonly issues: readonly ValidationIssue[];
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  const label = `${axis[0]!.toUpperCase()}最小角`;
  const inputId = `placement-${axis}`;
  const helpId = `${inputId}-help`;
  const unitId = `${inputId}-unit`;
  const errorId = `${inputId}-error`;
  const issue = issueFor(issues, axis);

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="field__control">
        <input
          id={inputId}
          name={inputId}
          value={value}
          inputMode="text"
          maxLength={9}
          aria-invalid={issue === undefined ? undefined : true}
          aria-describedby={`${unitId} ${helpId}${issue === undefined ? "" : ` ${errorId}`}`}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="field__unit" id={unitId}>mm</span>
      </div>
      <span className="field__help" id={helpId}>-1,000,000〜1,000,000の半角整数</span>
      {issue === undefined ? null : (
        <span className="field__error" id={errorId}>
          エラー: {placementIssueMessage(issue)}
        </span>
      )}
    </div>
  );
}

export function PlacementPanel({
  onInteractionChange,
  onProjectChange,
  project,
  selectedContainerId,
}: PlacementPanelProps) {
  const [editor, setEditor] = useState<PlacementEditor>();
  const [deleteTarget, setDeleteTarget] = useState<PlacementTarget>();
  const [draft, setDraft] = useState<PlacementDraft>();
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [status, setStatus] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const previousSelectedContainerId = useRef(selectedContainerId);
  const interactionActive = editor !== undefined || deleteTarget !== undefined;
  const placedCargoIds = new Set(project.placements.map((placement) => placement.cargoId));
  const unplacedCargoes = project.cargoes.filter((cargo) => !placedCargoIds.has(cargo.id));
  const selectedPlacements =
    selectedContainerId === undefined
      ? []
      : project.placements.filter(
          (placement) => placement.containerId === selectedContainerId,
        );
  const editedCargo = project.cargoes.find((cargo) => cargo.id === editor?.cargoId);

  const closeInteraction = () => {
    setEditor(undefined);
    setDeleteTarget(undefined);
    setDraft(undefined);
    setIssues([]);
    onInteractionChange(false);
  };

  useEffect(() => {
    const previous = previousSelectedContainerId.current;
    previousSelectedContainerId.current = selectedContainerId;
    if (previous === selectedContainerId || interactionActive) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setDraft(undefined);
      setIssues([]);
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [interactionActive, selectedContainerId]);

  useEffect(() => {
    const editorCargoExists =
      editor === undefined || project.cargoes.some((cargo) => cargo.id === editor.cargoId);
    const editorContainerExists =
      editor === undefined ||
      project.containers.some((container) => container.id === editor.containerId);
    const editorTargetExists =
      editor === undefined ||
      (editor.kind === "new"
        ? !project.placements.some((placement) => placement.cargoId === editor.cargoId)
        : project.placements.some(
            (placement) =>
              placement.cargoId === editor.cargoId &&
              placement.containerId === editor.containerId,
          ));
    const deleteTargetExists =
      deleteTarget === undefined ||
      (project.cargoes.some((cargo) => cargo.id === deleteTarget.cargoId) &&
        project.containers.some(
          (container) => container.id === deleteTarget.containerId,
        ) &&
        project.placements.some(
          (placement) =>
            placement.cargoId === deleteTarget.cargoId &&
            placement.containerId === deleteTarget.containerId,
        ));

    if (
      editorCargoExists &&
      editorContainerExists &&
      editorTargetExists &&
      deleteTargetExists
    ) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setEditor(undefined);
      setDeleteTarget(undefined);
      setDraft(undefined);
      setIssues([]);
      setStatus(
        editor === undefined
          ? "対象の配置が最新の案件に見つからないため、削除確認を閉じました。"
          : editor.kind === "new"
            ? "積荷または候補の状態が変わったため、新しい配置を追加せず編集を閉じました。"
            : "対象の配置が最新の案件に見つからないため、編集を閉じました。",
      );
      onInteractionChange(false);
      focusPreferredOrPanel();
    });

    return () => {
      cancelled = true;
    };
  }, [deleteTarget, editor, onInteractionChange, project]);

  const commandFailure = (result: Extract<ProjectCommandResult, { ok: false }>) => {
    setIssues(result.issues);
    setStatus(result.issues.map(placementIssueMessage).join(" "));
  };

  const beginAdd = (cargoId: string) => {
    if (selectedContainerId === undefined) {
      setStatus("配置先の候補を選択してください。");
      return;
    }
    const cargo = project.cargoes.find((candidate) => candidate.id === cargoId);
    const orientation = cargo?.allowedOrientations[0];
    if (cargo === undefined || orientation === undefined) {
      setIssues([]);
      setStatus("対象の積荷を確認できないため、新しい配置を開けませんでした。");
      focusPreferredOrPanel();
      return;
    }
    if (!project.containers.some((container) => container.id === selectedContainerId)) {
      setIssues([]);
      setStatus("選択した候補を確認できないため、新しい配置を開けませんでした。");
      focusPreferredOrPanel();
      return;
    }
    setEditor({ kind: "new", cargoId, containerId: selectedContainerId });
    setDraft({ xMm: "0", yMm: "0", zMm: "0", orientation });
    setIssues([]);
    setStatus("新しい配置を入力中です。配置を保存するまで案件と3D表示へ反映しません。");
    onInteractionChange(true);
    focusElement("placement-xMm");
  };

  const beginEdit = (placement: Placement) => {
    setEditor({
      kind: "edit",
      cargoId: placement.cargoId,
      containerId: placement.containerId,
    });
    setDeleteTarget(undefined);
    setDraft(draftFromPlacement(placement));
    setIssues([]);
    setStatus("配置の編集を開きました。保存またはキャンセルしてください。");
    onInteractionChange(true);
    focusElement("placement-xMm");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (editor === undefined || draft === undefined) {
      return;
    }
    const result =
      editor.kind === "new"
        ? addPlacement(
            project,
            editor.cargoId,
            editor.containerId,
            draft,
          )
        : updatePlacement(
            project,
            editor.cargoId,
            editor.containerId,
            draft,
          );
    if (!result.ok) {
      const staleInteraction = result.issues.some((issue) =>
        [
          "command.placement-not-found",
          "command.cargo-not-found",
          "command.container-not-found",
          "command.cargo-already-placed",
        ].includes(issue.code),
      );
      if (staleInteraction) {
        closeInteraction();
        setStatus(
          editor.kind === "new"
            ? "積荷または候補の状態が変わったため、新しい配置を追加せず編集を閉じました。"
            : "対象の配置が見つからないため、編集を閉じました。",
        );
        focusPreferredOrPanel();
        return;
      }
      commandFailure(result);
      queueMicrotask(() =>
        formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(),
      );
      return;
    }

    const returnId = `placement-edit-${editor.cargoId}`;
    const wasNew = editor.kind === "new";
    onProjectChange(result.project);
    closeInteraction();
    setStatus(
      wasNew
        ? "新しい配置を保存しました。適合判定は未実施です。"
        : "配置を保存しました。適合判定は未実施です。",
    );
    focusPreferredOrPanel(returnId);
  };

  const cancelEdit = () => {
    const preferredId =
      editor === undefined
        ? undefined
        : editor.kind === "new"
          ? `placement-add-${editor.cargoId}`
          : `placement-edit-${editor.cargoId}`;
    const wasNew = editor?.kind === "new";
    closeInteraction();
    setStatus(
      wasNew
        ? "新しい配置を追加せず、未保存入力を破棄しました。"
        : "配置の未保存入力を破棄して編集をキャンセルしました。",
    );
    focusPreferredOrPanel(preferredId);
  };

  const beginDelete = (placement: Placement) => {
    setDeleteTarget({
      cargoId: placement.cargoId,
      containerId: placement.containerId,
    });
    setIssues([]);
    setStatus("配置の削除を確認してください。");
    onInteractionChange(true);
    focusElement(`placement-delete-confirm-${placement.cargoId}`);
  };

  const confirmDelete = () => {
    if (deleteTarget === undefined) {
      return;
    }
    const result = deletePlacement(
      project,
      deleteTarget.cargoId,
      deleteTarget.containerId,
    );
    if (!result.ok) {
      commandFailure(result);
      if (result.issues.some((issue) => issue.code === "command.placement-not-found")) {
        closeInteraction();
        setStatus("対象の配置が見つからないため、削除確認を閉じました。");
        focusPreferredOrPanel();
      }
      return;
    }
    const cargoId = deleteTarget.cargoId;
    onProjectChange(result.project);
    closeInteraction();
    setStatus("配置を削除しました。積荷は未配置一覧へ戻りました。");
    focusPreferredOrPanel(`placement-add-${cargoId}`);
  };

  const cancelDelete = () => {
    const preferredId =
      deleteTarget === undefined
        ? undefined
        : `placement-delete-${deleteTarget.cargoId}`;
    closeInteraction();
    setStatus("配置の削除をキャンセルしました。");
    focusPreferredOrPanel(preferredId);
  };

  const orientationIssue = issueFor(issues, "orientation");

  return (
    <section className="placement-panel" aria-labelledby="placement-panel-title">
      <div className="placement-panel__heading">
        <div>
          <h4 id="placement-panel-title" tabIndex={-1}>配置</h4>
          <p>選択候補 {selectedPlacements.length}件 / 案件全体 {project.placements.length}件</p>
        </div>
      </div>

      <p className="action-status" aria-live="polite" aria-atomic="true">{status}</p>

      {issues.length === 0 ? null : (
        <div className="placement-errors" aria-label="配置エラー">
          <strong>配置を更新できませんでした</strong>
          <ul>
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.path}-${index}`}>
                {placementIssueMessage(issue)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedContainerId === undefined ? (
        <p className="empty-state">配置を編集するには候補を追加してください。</p>
      ) : (
        <>
          <div className="placement-panel__group">
            <h5>未配置の積荷</h5>
            {unplacedCargoes.length === 0 ? (
              <p className="empty-state">未配置の積荷はありません。</p>
            ) : (
              <ul className="placement-list" aria-label="未配置の積荷一覧">
                {unplacedCargoes.map((cargo) => (
                  <li key={cargo.id}>
                    <span>{cargo.name}</span>
                    <button
                      id={`placement-add-${cargo.id}`}
                      type="button"
                      disabled={interactionActive}
                      onClick={() => beginAdd(cargo.id)}
                    >
                      配置を追加: {cargo.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="placement-panel__group">
            <h5>選択候補の配置</h5>
            {selectedPlacements.length === 0 ? (
              <p className="empty-state">この候補に配置された積荷はありません。</p>
            ) : (
              <ul className="placement-list" aria-label="選択候補の配置一覧">
                {selectedPlacements.map((placement) => {
                  const cargo = project.cargoes.find(
                    (candidate) => candidate.id === placement.cargoId,
                  );
                  const cargoName = cargo?.name ?? "不明な積荷";
                  return (
                    <li key={placement.cargoId}>
                      <div>
                        <strong>{cargoName}</strong>
                        <span>
                          最小角 X {placement.positionMm.xMm}・Y {placement.positionMm.yMm}・Z {placement.positionMm.zMm} mm / {placement.orientation}
                        </span>
                      </div>
                      <div className="button-row">
                        <button
                          id={`placement-edit-${placement.cargoId}`}
                          type="button"
                          disabled={interactionActive || cargo === undefined}
                          onClick={() => beginEdit(placement)}
                        >
                          編集: {cargoName}
                        </button>
                        <button
                          id={`placement-delete-${placement.cargoId}`}
                          type="button"
                          disabled={interactionActive}
                          onClick={() => beginDelete(placement)}
                        >
                          配置を削除: {cargoName}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {editor === undefined || draft === undefined ? null : (
            <form ref={formRef} className="placement-form" onSubmit={submit} noValidate>
              <fieldset>
                <legend>
                  {editor.kind === "new" ? "新しい配置" : "配置を編集"}: {editedCargo?.name ?? "不明な積荷"}
                </legend>
                <p className="field-help warning-copy">
                  座標は向き適用後の直方体の最小角です。負座標や候補外も修正途中として保存できますが、適合性と安全性は未判定です。
                </p>
                <div className="placement-coordinate-grid">
                  <PositionField
                    axis="xMm"
                    value={draft.xMm}
                    issues={issues}
                    onChange={(xMm) => setDraft({ ...draft, xMm })}
                  />
                  <PositionField
                    axis="yMm"
                    value={draft.yMm}
                    issues={issues}
                    onChange={(yMm) => setDraft({ ...draft, yMm })}
                  />
                  <PositionField
                    axis="zMm"
                    value={draft.zMm}
                    issues={issues}
                    onChange={(zMm) => setDraft({ ...draft, zMm })}
                  />
                </div>
                <div className="placement-orientation-field">
                  <label htmlFor="placement-orientation">向き</label>
                  <select
                    id="placement-orientation"
                    value={draft.orientation}
                    aria-invalid={orientationIssue === undefined ? undefined : true}
                    aria-describedby={
                      orientationIssue === undefined ? undefined : "placement-orientation-error"
                    }
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        orientation: event.target.value as Orientation,
                      })
                    }
                  >
                    {editedCargo?.allowedOrientations.map((orientation) => (
                      <option key={orientation} value={orientation}>
                        {orientation} — {ORIENTATION_COPY[orientation]}
                      </option>
                    ))}
                  </select>
                  {orientationIssue === undefined ? null : (
                    <span className="field__error" id="placement-orientation-error">
                      エラー: {placementIssueMessage(orientationIssue)}
                    </span>
                  )}
                </div>
              </fieldset>
              <div className="button-row">
                <button className="primary-button" type="submit">配置を保存</button>
                <button type="button" onClick={cancelEdit}>配置編集をキャンセル</button>
              </div>
            </form>
          )}

          {deleteTarget === undefined ? null : (
            <div className="confirm-panel" role="alert">
              <p>この配置を削除しますか。積荷定義は残り、未配置一覧へ戻ります。</p>
              <div className="button-row">
                <button
                  id={`placement-delete-confirm-${deleteTarget.cargoId}`}
                  className="danger-button"
                  type="button"
                  onClick={confirmDelete}
                >
                  配置の削除を確定
                </button>
                <button type="button" onClick={cancelDelete}>配置の削除をやめる</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
