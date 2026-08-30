import { useRef, useState, type FormEvent } from "react";

import {
  deleteCargo,
  saveCargo,
  type CargoDraft,
} from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import type { Cargo, Project } from "../domain/model";
import {
  isUprightOnlyOrientationPolicy,
  orientationsForUprightPolicy,
} from "../domain/orientation-policy";
import type { ValidationIssue } from "../domain/validation";
import { ModalShell } from "./ModalShell";

export type CargoEditorIntent =
  | { readonly kind: "add" }
  | { readonly cargoId: string; readonly kind: "edit" | "delete" };
export type CargoEditorRequest = CargoEditorIntent & {
  readonly key: number;
  readonly returnScrollPosition: { readonly left: number; readonly top: number };
};

interface CargoEditorDialogProps {
  readonly onClose: () => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly project: Project;
  readonly request: CargoEditorRequest;
}

const EMPTY_CARGO_DRAFT: CargoDraft = {
  name: "",
  lengthMm: "",
  widthMm: "",
  heightMm: "",
  massKg: "",
  canSupportCargo: false,
  allowedOrientations: orientationsForUprightPolicy(true),
};

function gramsToKilograms(grams: number): string {
  const whole = Math.floor(grams / 1000);
  const fraction = String(grams % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction.length === 0 ? String(whole) : `${whole}.${fraction}`;
}

function cargoDraftFrom(cargo: Cargo): CargoDraft {
  return {
    name: cargo.name,
    lengthMm: String(cargo.dimensionsMm.lengthMm),
    widthMm: String(cargo.dimensionsMm.widthMm),
    heightMm: String(cargo.dimensionsMm.heightMm),
    massKg: gramsToKilograms(cargo.massGrams),
    canSupportCargo: cargo.canSupportCargo,
    allowedOrientations: orientationsForUprightPolicy(
      isUprightOnlyOrientationPolicy(cargo.allowedOrientations),
    ),
  };
}

function issueMessage(issue: ValidationIssue): string {
  const messages: Record<string, string> = {
    "input.mm-format": "mmは半角数字だけの整数で入力してください。",
    "input.mm-length": "mmの入力桁数が上限を超えています。",
    "input.mm-range": "mmの値が入力可能な範囲外です。",
    "input.kg-format": "kgは半角数字で、小数は3桁まで入力してください。",
    "input.kg-length": "kgの入力桁数が上限を超えています。",
    "input.kg-range": "kgの値が入力可能な範囲外です。",
    "input.orientation-required": "許可する向きを1つ以上選択してください。",
    "schema.minLength": "名称を入力してください。",
    "schema.maxLength": "名称は120文字以内で入力してください。",
    "schema.pattern": "名称に制御文字は使用できません。",
    "semantic.disallowed-orientation": "配置で使用中の向きは許可から外せません。",
    "command.cargo-limit": "積荷は最大1,000件です。",
    "command.cargo-referenced": "配置中の積荷は削除できません。先に荷室から外してください。",
    "command.cargo-not-found": "対象の積荷が見つかりません。",
  };
  return messages[issue.code] ?? "入力内容を確認してください。";
}

function issueFor(issues: readonly ValidationIssue[], field: string) {
  return issues.find((issue) =>
    field === "name"
      ? issue.path.endsWith("/name") || issue.path === "/name"
      : issue.path.includes(field),
  );
}

function Field({
  id,
  issues,
  label,
  maxLength,
  onChange,
  unit,
  value,
}: {
  readonly id: string;
  readonly issues: readonly ValidationIssue[];
  readonly label: string;
  readonly maxLength: number;
  readonly onChange: (value: string) => void;
  readonly unit?: string;
  readonly value: string;
}) {
  const issue = issueFor(issues, id.replace("cargo-", ""));
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input
          id={id}
          value={value}
          maxLength={maxLength}
          aria-invalid={issue === undefined ? undefined : true}
          aria-describedby={issue === undefined ? undefined : errorId}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit === undefined ? null : <span className="field__unit">{unit}</span>}
      </div>
      {issue === undefined ? null : (
        <span id={errorId} className="field__error">エラー: {issueMessage(issue)}</span>
      )}
    </div>
  );
}

export function CargoEditorDialog({
  onClose,
  onProjectCommit,
  project,
  request,
}: CargoEditorDialogProps) {
  const target = request.kind === "add"
    ? undefined
    : project.cargoes.find((cargo) => cargo.id === request.cargoId);
  const [draft, setDraft] = useState<CargoDraft>(() =>
    target === undefined ? EMPTY_CARGO_DRAFT : cargoDraftFrom(target),
  );
  const [originalDraft] = useState(draft);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [status, setStatus] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(originalDraft);
  const placement = target === undefined
    ? undefined
    : project.placements.find((candidate) => candidate.cargoId === target.id);
  const uprightOnly = isUprightOnlyOrientationPolicy(draft.allowedOrientations);
  const title = target?.name ?? (request.kind === "add" ? "積荷を追加" : "積荷情報");

  const requestClose = () => {
    if (confirmDiscard) {
      setConfirmDiscard(false);
      setStatus("編集を続けます。");
      return;
    }
    if (dirty) {
      setConfirmDiscard(true);
      setStatus("未保存入力を破棄するか確認してください。");
      return;
    }
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = saveCargo(project, draft, target?.id);
    if (!result.ok) {
      setIssues(result.issues);
      setStatus("");
      queueMicrotask(() => {
        const summary = document.getElementById("cargo-dialog-errors");
        summary?.focus({ preventScroll: true });
      });
      return;
    }
    const transition = onProjectCommit({
      baseProject: project,
      nextProject: result.project,
      action: target === undefined ? "cargo.add" : "cargo.update",
    });
    if (!transition.ok) {
      setStatus("案件が更新されたため保存できませんでした。入力内容は保持しています。");
      return;
    }
    onClose();
  };

  const removeCargo = () => {
    if (target === undefined || placement !== undefined) return;
    const result = deleteCargo(project, target.id);
    if (!result.ok) {
      setIssues(result.issues);
      setConfirmDelete(false);
      return;
    }
    const transition = onProjectCommit({
      baseProject: project,
      nextProject: result.project,
      action: "cargo.delete",
    });
    if (!transition.ok) {
      setStatus("案件が更新されたため積荷を削除できませんでした。");
      return;
    }
    onClose();
  };

  if (request.kind !== "add" && target === undefined) {
    return (
      <ModalShell fallbackFocusIds={["scene-cargo-select", "cargo-add-button"]} title="積荷情報" onRequestClose={onClose}>
        <p role="alert">対象の積荷が見つかりません。案件を確認してください。</p>
        <button type="button" onClick={onClose}>閉じる</button>
      </ModalShell>
    );
  }

  if (request.kind === "delete" && target !== undefined) {
    return (
      <ModalShell
        fallbackFocusIds={["scene-cargo-select", "cargo-add-button"]}
        initialFocusId={`cargo-delete-confirm-${target.id}`}
        returnScrollPosition={request.returnScrollPosition}
        title={`${target.name}を削除`}
        onRequestClose={onClose}
      >
        <div className="confirm-panel" role="alert">
          <p>未配置の{target.name}自体を削除します。配置からの連鎖削除は行いません。元に戻せます。</p>
          <div className="button-row">
            <button id={`cargo-delete-confirm-${target.id}`} className="danger-button" type="button" onClick={removeCargo}>削除を確定: {target.name}</button>
            <button type="button" onClick={onClose}>削除をやめる: {target.name}</button>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell fallbackFocusIds={["scene-cargo-select", "cargo-add-button"]} returnScrollPosition={request.returnScrollPosition} title={title} initialFocusId="cargo-name" onRequestClose={requestClose}>
      <p className="action-status" aria-live="polite">{status}</p>
      {issues.length === 0 ? null : (
        <div id="cargo-dialog-errors" className="error-summary" role="alert" tabIndex={-1}>
          <strong>保存できませんでした</strong>
          <ul>{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issueMessage(issue)}</li>)}</ul>
        </div>
      )}

      {confirmDiscard ? (
        <div className="confirm-panel" role="alert">
          <p>未保存の積荷入力を破棄して閉じますか。</p>
          <div className="button-row">
            <button className="danger-button" type="button" onClick={onClose}>入力を破棄して閉じる</button>
            <button type="button" onClick={() => setConfirmDiscard(false)}>編集を続ける</button>
          </div>
        </div>
      ) : null}

      <form ref={formRef} className="detail-form" onSubmit={submit} noValidate>
        <fieldset>
          <legend>積荷情報</legend>
          <Field id="cargo-name" label="積荷名" maxLength={120} value={draft.name} issues={issues} onChange={(name) => setDraft({ ...draft, name })} />
          <div className="dimension-grid">
            <Field id="cargo-lengthMm" label="長さ" unit="mm" maxLength={6} value={draft.lengthMm} issues={issues} onChange={(lengthMm) => setDraft({ ...draft, lengthMm })} />
            <Field id="cargo-widthMm" label="幅" unit="mm" maxLength={6} value={draft.widthMm} issues={issues} onChange={(widthMm) => setDraft({ ...draft, widthMm })} />
            <Field id="cargo-heightMm" label="高さ" unit="mm" maxLength={6} value={draft.heightMm} issues={issues} onChange={(heightMm) => setDraft({ ...draft, heightMm })} />
          </div>
          <Field id="cargo-massGrams" label="重量" unit="kg" maxLength={10} value={draft.massKg} issues={issues} onChange={(massKg) => setDraft({ ...draft, massKg })} />
        </fieldset>
        <fieldset>
          <legend>取扱い</legend>
          <label className="check-row check-row--emphasis">
            <input
              type="checkbox"
              checked={uprightOnly}
              onChange={(event) => setDraft({
                ...draft,
                allowedOrientations: orientationsForUprightPolicy(event.target.checked),
              })}
            />
            <span><strong>天地無用</strong> — 高さを上向きに保ち、X軸回転を禁止する</span>
          </label>
          <p className="field-help">床面上のZ軸回転は常に利用できます。天地無用を外すとX軸回転による横倒しも許可します。向きコードは面の上下反転を区別しません。</p>
        </fieldset>
        <fieldset>
          <legend>段積み設定</legend>
          <label className="check-row">
            <input type="checkbox" checked={draft.canSupportCargo} onChange={(event) => setDraft({ ...draft, canSupportCargo: event.target.checked })} />
            <span>この積荷の上面で別の積荷を幾何学的に支持できる</span>
          </label>
        </fieldset>
        {placement === undefined ? null : (
          <p className="warning-copy">{project.containers.find((container) => container.id === placement.containerId)?.name ?? "候補"}に配置中です。横倒し配置中は天地無用へ変更できません。積荷自体を削除するには先に荷室から外してください。</p>
        )}
        <div className="button-row modal-shell__actions">
          <button className="primary-button" type="submit">{target === undefined ? "積荷を保存" : "積荷情報を保存"}</button>
          <button type="button" onClick={requestClose}>キャンセル</button>
          {target === undefined ? null : (
            <button
              className="danger-button"
              type="button"
              aria-disabled={placement === undefined ? undefined : true}
              aria-describedby={placement === undefined ? undefined : "cargo-delete-disabled-reason"}
              onClick={() => {
                if (placement !== undefined) {
                  setStatus("配置中の積荷です。先に荷室から外してください。");
                  return;
                }
                setConfirmDelete(true);
                queueMicrotask(() => document.getElementById(`cargo-delete-confirm-${target.id}`)?.focus({ preventScroll: true }));
              }}
            >
              積荷自体を削除
            </button>
          )}
        </div>
        {placement === undefined ? null : <span id="cargo-delete-disabled-reason" className="visually-hidden">配置中のため、先に荷室から外してください。</span>}
      </form>

      {confirmDelete && target !== undefined ? (
        <div className="confirm-panel" role="alert">
          <p>未配置の{target.name}自体を削除します。配置からの連鎖削除は行いません。元に戻せます。</p>
          <div className="button-row">
            <button id={`cargo-delete-confirm-${target.id}`} className="danger-button" type="button" onClick={removeCargo}>削除を確定: {target.name}</button>
            <button type="button" onClick={() => setConfirmDelete(false)}>削除をやめる: {target.name}</button>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}
