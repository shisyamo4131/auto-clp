import { useRef, useState, type FormEvent } from "react";

import {
  updateProjectSettings,
  type ProjectSettingsDraft,
} from "../application/project-command";
import type { ProjectHistoryCommitHandler } from "../application/project-history";
import type { Project } from "../domain/model";
import type { ValidationIssue } from "../domain/validation";
import { ModalShell } from "./ModalShell";

interface ProjectSettingsDialogProps {
  readonly onClose: () => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly project: Project;
}

function issueMessage(issue: ValidationIssue): string {
  const messages: Record<string, string> = {
    "input.mm-format": "mmは半角数字だけの整数で入力してください。",
    "input.mm-length": "mmの入力桁数が上限を超えています。",
    "input.mm-range": "mmの値が入力可能な範囲外です。",
    "schema.minLength": "名称を入力してください。",
    "schema.maxLength": "名称は120文字以内で入力してください。",
    "schema.pattern": "名称に制御文字は使用できません。",
  };
  return messages[issue.code] ?? "入力内容を確認してください。";
}

function Field({
  id,
  issueField,
  issues,
  label,
  maxLength,
  onChange,
  unit,
  value,
}: {
  readonly id: string;
  readonly issueField: string;
  readonly issues: readonly ValidationIssue[];
  readonly label: string;
  readonly maxLength: number;
  readonly onChange: (value: string) => void;
  readonly unit?: string;
  readonly value: string;
}) {
  const issue = issues.find((candidate) =>
    issueField === "name"
      ? candidate.path.endsWith("/name") || candidate.path === "/name"
      : candidate.path.includes(issueField),
  );
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input
          id={id}
          value={value}
          maxLength={maxLength}
          inputMode={unit === "mm" ? "numeric" : "text"}
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

function projectSettingsDraftFrom(project: Project): ProjectSettingsDraft {
  return {
    name: project.name,
    clearanceXmm: String(project.clearancesMm.xMm),
    clearanceYmm: String(project.clearancesMm.yMm),
    clearanceZmm: String(project.clearancesMm.zMm),
  };
}

export function ProjectSettingsDialog({
  onClose,
  onProjectCommit,
  project,
}: ProjectSettingsDialogProps) {
  const [draft, setDraft] = useState<ProjectSettingsDraft>(() =>
    projectSettingsDraftFrom(project),
  );
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [status, setStatus] = useState("");
  const [discardConfirmation, setDiscardConfirmation] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(projectSettingsDraftFrom(project));

  const requestClose = () => {
    if (dirty) {
      setDiscardConfirmation(true);
      return;
    }
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = updateProjectSettings(project, draft);
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
      action: "project-settings.update",
    });
    if (!transition.ok) {
      setStatus("CLPが更新されたため保存できませんでした。入力内容を確認して再度保存してください。");
      return;
    }
    onClose();
  };

  return (
    <ModalShell
      fallbackFocusIds={["current-project-settings-button", "app-navigation-button"]}
      initialFocusId="project-name"
      onRequestClose={requestClose}
      title="CLP設定"
    >
      <p className="section-help">CLP名と固定隙間を編集します。保存するまでCLPデータへ反映しません。</p>
      <form ref={formRef} onSubmit={submit} noValidate>
        {issues.length === 0 ? null : (
          <div className="error-summary" role="alert">
            <strong>保存できませんでした</strong>
            <ul>{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issueMessage(issue)}</li>)}</ul>
          </div>
        )}
        <fieldset>
          <legend>基本情報</legend>
          <Field id="project-name" label="CLP名" value={draft.name} issues={issues} issueField="name" maxLength={120} onChange={(name) => setDraft({ ...draft, name })} />
        </fieldset>
        <fieldset>
          <legend>軸別の固定隙間</legend>
          <div className="dimension-grid">
            <Field id="clearance-x" label="X方向の隙間" unit="mm" value={draft.clearanceXmm} issues={issues} issueField="xMm" maxLength={5} onChange={(clearanceXmm) => setDraft({ ...draft, clearanceXmm })} />
            <Field id="clearance-y" label="Y方向の隙間" unit="mm" value={draft.clearanceYmm} issues={issues} issueField="yMm" maxLength={5} onChange={(clearanceYmm) => setDraft({ ...draft, clearanceYmm })} />
            <Field id="clearance-z" label="Z方向の隙間" unit="mm" value={draft.clearanceZmm} issues={issues} issueField="zMm" maxLength={5} onChange={(clearanceZmm) => setDraft({ ...draft, clearanceZmm })} />
          </div>
        </fieldset>
        <div className="button-row">
          <button id="project-save-button" className="primary-button" type="submit">CLPを保存</button>
          <button type="button" onClick={requestClose}>閉じる</button>
        </div>
      </form>
      <p className="action-status" aria-live="polite" aria-atomic="true">{status}</p>
      {discardConfirmation ? (
        <div className="confirm-panel" role="alert">
          <p>保存していないCLP設定があります。変更を破棄して閉じますか。</p>
          <div className="button-row">
            <button className="danger-button" type="button" onClick={onClose}>変更を破棄</button>
            <button type="button" onClick={() => setDiscardConfirmation(false)}>編集を続ける</button>
          </div>
        </div>
      ) : null}
    </ModalShell>
  );
}
