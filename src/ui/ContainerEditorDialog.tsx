import { useRef, useState, type FormEvent } from "react";

import {
  deleteContainer,
  saveContainer,
  type ContainerDraft,
} from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import type { Container, Project } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";
import { ModalShell } from "./ModalShell";

export type ContainerEditorIntent =
  | { readonly kind: "add" }
  | { readonly containerId: string; readonly kind: "edit" | "delete" };
export type ContainerEditorRequest = ContainerEditorIntent & {
  readonly key: number;
  readonly returnScrollPosition: { readonly left: number; readonly top: number };
};

interface ContainerEditorDialogProps {
  readonly onClose: () => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly project: Project;
  readonly request: ContainerEditorRequest;
}

const EMPTY_CONTAINER_DRAFT: ContainerDraft = {
  name: "",
  internalLengthMm: "",
  internalWidthMm: "",
  internalHeightMm: "",
  openingWidthMm: "",
  openingHeightMm: "",
  payloadCapacityKg: "",
};

function gramsToKilograms(grams: number): string {
  const whole = Math.floor(grams / 1000);
  const fraction = String(grams % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction.length === 0 ? String(whole) : `${whole}.${fraction}`;
}

function containerDraftFrom(container: Container): ContainerDraft {
  return {
    name: container.name,
    internalLengthMm: String(container.internalDimensionsMm.lengthMm),
    internalWidthMm: String(container.internalDimensionsMm.widthMm),
    internalHeightMm: String(container.internalDimensionsMm.heightMm),
    openingWidthMm: String(container.openingMm.widthMm),
    openingHeightMm: String(container.openingMm.heightMm),
    payloadCapacityKg: gramsToKilograms(container.payloadCapacityGrams),
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
    "schema.minLength": "名称を入力してください。",
    "schema.maxLength": "名称は120文字以内で入力してください。",
    "schema.pattern": "名称に制御文字は使用できません。",
    "semantic.opening-width-exceeds-internal": "開口幅は内部幅以下にしてください。",
    "semantic.opening-height-exceeds-internal": "開口高さは内部高さ以下にしてください。",
    "command.container-limit": "コンテナは最大100件です。",
    "command.container-referenced":
      "積荷を配置中のコンテナは削除できません。先にすべての積荷を荷室から外してください。",
    "command.container-not-found": "対象のコンテナが見つかりません。",
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
  const issue = issueFor(issues, id.replace("container-", ""));
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
          inputMode={unit === "kg" ? "decimal" : unit === "mm" ? "numeric" : "text"}
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

export function ContainerEditorDialog({
  onClose,
  onProjectCommit,
  project,
  request,
}: ContainerEditorDialogProps) {
  const target = request.kind === "add"
    ? undefined
    : project.containers.find((container) => container.id === request.containerId);
  const [draft, setDraft] = useState<ContainerDraft>(() =>
    target === undefined ? EMPTY_CONTAINER_DRAFT : containerDraftFrom(target),
  );
  const [originalDraft] = useState(draft);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [status, setStatus] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(originalDraft);
  const title = target?.name ?? (request.kind === "add" ? "コンテナを追加" : "コンテナ情報");

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
    const result = saveContainer(project, draft, target?.id);
    if (!result.ok) {
      setIssues(result.issues);
      setStatus("");
      queueMicrotask(() => {
        formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus({ preventScroll: true });
      });
      return;
    }
    const transition = onProjectCommit({
      baseProject: project,
      nextProject: result.project,
      action: target === undefined ? "container.add" : "container.update",
    });
    if (!transition.ok) {
      setStatus("CLPが更新されたためコンテナを保存できませんでした。入力内容は保持しています。");
      return;
    }
    onClose();
  };

  const removeContainer = () => {
    if (target === undefined) return;
    const result = deleteContainer(project, target.id);
    if (!result.ok) {
      setIssues(result.issues);
      setStatus(issueMessage(result.issues[0] ?? { code: "command.container-referenced", path: "/containers" }));
      return;
    }
    const transition = onProjectCommit({
      baseProject: project,
      nextProject: result.project,
      action: "container.delete",
    });
    if (!transition.ok) {
      setStatus("CLPが更新されたためコンテナを削除できませんでした。削除確認をやり直してください。");
      return;
    }
    onClose();
  };

  if (request.kind !== "add" && target === undefined) {
    return (
      <ModalShell fallbackFocusIds={["app-navigation-button"]} title="コンテナ情報" onRequestClose={onClose}>
        <p role="alert">対象のコンテナが見つかりません。CLPを確認してください。</p>
        <button type="button" onClick={onClose}>閉じる</button>
      </ModalShell>
    );
  }

  if (request.kind === "delete" && target !== undefined) {
    return (
      <ModalShell
        fallbackFocusIds={["app-navigation-button"]}
        initialFocusId={`container-delete-confirm-${target.id}`}
        returnScrollPosition={request.returnScrollPosition}
        title={`${target.name}を削除`}
        onRequestClose={onClose}
      >
        <p className="action-status" aria-live="polite">{status}</p>
        {issues.length === 0 ? null : (
          <div className="error-summary" role="alert">
            <strong>削除できませんでした</strong>
            <ul>{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issueMessage(issue)}</li>)}</ul>
          </div>
        )}
        <div className="confirm-panel" role="alert">
          <p>{target.name}を削除します。配置からの連鎖削除は行いません。元に戻せます。</p>
          <div className="button-row">
            <button id={`container-delete-confirm-${target.id}`} className="danger-button" type="button" onClick={removeContainer}>削除を確定: {target.name}</button>
            <button type="button" onClick={onClose}>削除をやめる: {target.name}</button>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      fallbackFocusIds={["app-navigation-button"]}
      initialFocusId="container-name"
      returnScrollPosition={request.returnScrollPosition}
      title={title}
      onRequestClose={requestClose}
    >
      <p className="action-status" aria-live="polite">{status}</p>
      {issues.length === 0 ? null : (
        <div className="error-summary" role="alert" tabIndex={-1}>
          <strong>保存できませんでした</strong>
          <ul>{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issueMessage(issue)}</li>)}</ul>
        </div>
      )}
      {confirmDiscard ? (
        <div className="confirm-panel" role="alert">
          <p>未保存のコンテナ入力を破棄して閉じますか。</p>
          <div className="button-row">
            <button className="danger-button" type="button" onClick={onClose}>入力を破棄して閉じる</button>
            <button type="button" onClick={() => setConfirmDiscard(false)}>編集を続ける</button>
          </div>
        </div>
      ) : null}
      <form ref={formRef} className="detail-form" onSubmit={submit} noValidate>
        <fieldset>
          <legend>コンテナ情報</legend>
          <Field id="container-name" label="コンテナ名" value={draft.name} issues={issues} maxLength={120} onChange={(name) => setDraft({ ...draft, name })} />
          <div className="dimension-grid">
            <Field id="container-internalDimensionsMm/lengthMm" label="内部長さ" unit="mm" maxLength={6} value={draft.internalLengthMm} issues={issues} onChange={(internalLengthMm) => setDraft({ ...draft, internalLengthMm })} />
            <Field id="container-internalDimensionsMm/widthMm" label="内部幅" unit="mm" maxLength={6} value={draft.internalWidthMm} issues={issues} onChange={(internalWidthMm) => setDraft({ ...draft, internalWidthMm })} />
            <Field id="container-internalDimensionsMm/heightMm" label="内部高さ" unit="mm" maxLength={6} value={draft.internalHeightMm} issues={issues} onChange={(internalHeightMm) => setDraft({ ...draft, internalHeightMm })} />
          </div>
        </fieldset>
        <fieldset>
          <legend>負X側の矩形開口</legend>
          <div className="dimension-grid">
            <Field id="container-openingMm/widthMm" label="開口幅" unit="mm" maxLength={6} value={draft.openingWidthMm} issues={issues} onChange={(openingWidthMm) => setDraft({ ...draft, openingWidthMm })} />
            <Field id="container-openingMm/heightMm" label="開口高さ" unit="mm" maxLength={6} value={draft.openingHeightMm} issues={issues} onChange={(openingHeightMm) => setDraft({ ...draft, openingHeightMm })} />
          </div>
          <p className="field-help warning-copy">開口内回転や斜め通過を含む搬入経路は未確認です。</p>
        </fieldset>
        <fieldset>
          <legend>耐荷重</legend>
          <Field id="container-payloadCapacityGrams" label="総耐荷重" unit="kg" maxLength={10} value={draft.payloadCapacityKg} issues={issues} onChange={(payloadCapacityKg) => setDraft({ ...draft, payloadCapacityKg })} />
        </fieldset>
        <div className="button-row modal-shell__actions">
          <button className="primary-button" type="submit">{target === undefined ? "コンテナを保存" : "コンテナ情報を保存"}</button>
          <button type="button" onClick={requestClose}>キャンセル</button>
        </div>
      </form>
    </ModalShell>
  );
}
