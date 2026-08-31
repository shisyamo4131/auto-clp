import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  deleteCargo,
  deleteContainer,
  saveCargo,
  saveContainer,
  updateProjectSettings,
  type CargoDraft,
  type ContainerDraft,
  type ProjectCommandResult,
  type ProjectSettingsDraft,
} from "../application/project-command";
import type {
  ProjectHistoryAction,
  ProjectHistoryCommitHandler,
} from "../application/project-history";
import type { Cargo, Container, Project } from "../domain/model";
import {
  isUprightOnlyOrientationPolicy,
  orientationsForUprightPolicy,
} from "../domain/orientation-policy";
import type { ValidationIssue } from "../domain/validation";
import type { CargoEditorIntent } from "./CargoEditorDialog";
import { ModalShell } from "./ModalShell";

interface ProjectWorkspaceProps {
  readonly externalInteractionActive?: boolean;
  readonly historyRevision: number;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onOpenCargoEditor?: (intent: CargoEditorIntent) => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly project: Project;
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

const EMPTY_CONTAINER_DRAFT: ContainerDraft = {
  name: "",
  internalLengthMm: "",
  internalWidthMm: "",
  internalHeightMm: "",
  openingWidthMm: "",
  openingHeightMm: "",
  payloadCapacityKg: "",
};

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
    "semantic.opening-width-exceeds-internal": "開口幅は内部幅以下にしてください。",
    "semantic.opening-height-exceeds-internal": "開口高さは内部高さ以下にしてください。",
    "semantic.disallowed-orientation": "配置で使用中の向きは許可から外せません。",
    "command.cargo-limit": "積荷は最大1,000件です。",
    "command.container-limit": "候補は最大100件です。",
    "command.cargo-referenced": "配置で参照中の積荷は削除できません。",
    "command.container-referenced": "配置で参照中の候補は削除できません。",
    "command.cargo-not-found": "対象の積荷が見つかりません。一覧を確認してください。",
    "command.container-not-found": "対象の候補が見つかりません。一覧を確認してください。",
  };
  return messages[issue.code] ?? "入力内容を確認してください。";
}

function gramsToKilograms(grams: number): string {
  const whole = Math.floor(grams / 1000);
  const fraction = String(grams % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
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

function isIssueFor(issue: ValidationIssue, field: string): boolean {
  if (field === "name") return issue.path.endsWith("/name") || issue.path === "/name";
  return issue.path.includes(field);
}

function Field({
  id,
  label,
  unit,
  value,
  onChange,
  issues,
  issueField,
  inputMode = "text",
  help,
  maxLength,
}: {
  readonly id: string;
  readonly label: string;
  readonly unit?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly issues: readonly ValidationIssue[];
  readonly issueField: string;
  readonly inputMode?: "text" | "numeric" | "decimal";
  readonly help?: string;
  readonly maxLength?: number;
}) {
  const issue = issues.find((candidate) => isIssueFor(candidate, issueField));
  const errorId = `${id}-error`;
  const unitId = `${id}-unit`;
  const helpId = `${id}-help`;
  const describedBy = [
    unit === undefined ? undefined : unitId,
    help === undefined ? undefined : helpId,
    issue === undefined ? undefined : errorId,
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input
          id={id}
          name={id}
          value={value}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={issue === undefined ? undefined : true}
          aria-describedby={describedBy.length === 0 ? undefined : describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit === undefined ? null : <span className="field__unit" id={unitId}>{unit}</span>}
      </div>
      {help === undefined ? null : <span className="field__help" id={helpId}>{help}</span>}
      {issue === undefined ? null : (
        <span className="field__error" id={errorId}>
          エラー: {issueMessage(issue)}
        </span>
      )}
    </div>
  );
}

function ErrorSummary({ id, issues }: { readonly id: string; readonly issues: readonly ValidationIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <div id={id} className="error-summary" role="alert" tabIndex={-1}>
      <strong>保存できませんでした</strong>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.path}-${index}`}>{issueMessage(issue)}</li>
        ))}
      </ul>
    </div>
  );
}

type ApplyResultStatus = "success" | "command-failure" | "stale";

function applyResult(
  result: ProjectCommandResult,
  baseProject: Project,
  action: ProjectHistoryAction,
  onProjectCommit: ProjectHistoryCommitHandler,
  setIssues: (issues: readonly ValidationIssue[]) => void,
): ApplyResultStatus {
  if (!result.ok) {
    setIssues(result.issues);
    return "command-failure";
  }
  const transition = onProjectCommit({
    baseProject,
    nextProject: result.project,
    action,
  });
  if (!transition.ok) {
    setIssues([]);
    return "stale";
  }
  setIssues([]);
  return "success";
}

function focusFirstInvalid(form: HTMLFormElement | null): void {
  queueMicrotask(() => {
    form?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
}

function focusElement(id: string): void {
  queueMicrotask(() => document.getElementById(id)?.focus());
}

function projectSettingsDraftFrom(project: Project): ProjectSettingsDraft {
  return {
    name: project.name,
    clearanceXmm: String(project.clearancesMm.xMm),
    clearanceYmm: String(project.clearancesMm.yMm),
    clearanceZmm: String(project.clearancesMm.zMm),
  };
}

interface ProjectSettingsDialogProps {
  readonly onClose: () => void;
  readonly onProjectCommit: ProjectHistoryCommitHandler;
  readonly project: Project;
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
  const formRef = useRef<HTMLFormElement>(null);
  const [discardConfirmation, setDiscardConfirmation] = useState(false);
  const dirty =
    draft.name !== project.name ||
    draft.clearanceXmm !== String(project.clearancesMm.xMm) ||
    draft.clearanceYmm !== String(project.clearancesMm.yMm) ||
    draft.clearanceZmm !== String(project.clearancesMm.zMm);

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
    const applied = applyResult(
      result,
      project,
      "project-settings.update",
      onProjectCommit,
      setIssues,
    );
    if (applied !== "success") {
      setStatus(
        applied === "stale"
          ? "CLPが更新されたため保存できませんでした。入力内容を確認して再度保存してください。"
          : "",
      );
      focusFirstInvalid(formRef.current);
      return;
    }
    if (result.ok) {
      onClose();
      return;
    }
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
        <ErrorSummary id="project-settings-errors" issues={issues} />
        <fieldset>
          <legend>基本情報</legend>
          <Field
            id="project-name"
            label="CLP名"
            value={draft.name}
            issues={issues}
            issueField="name"
            maxLength={120}
            onChange={(name) => setDraft({ ...draft, name })}
          />
        </fieldset>
        <fieldset>
          <legend>軸別の固定隙間</legend>
          <div className="dimension-grid">
            <Field
              id="clearance-x"
              label="X方向の隙間"
              unit="mm"
              value={draft.clearanceXmm}
              issues={issues}
              issueField="xMm"
              inputMode="numeric"
              maxLength={5}
              help="0〜10,000の半角整数"
              onChange={(clearanceXmm) => setDraft({ ...draft, clearanceXmm })}
            />
            <Field
              id="clearance-y"
              label="Y方向の隙間"
              unit="mm"
              value={draft.clearanceYmm}
              issues={issues}
              issueField="yMm"
              inputMode="numeric"
              maxLength={5}
              help="0〜10,000の半角整数"
              onChange={(clearanceYmm) => setDraft({ ...draft, clearanceYmm })}
            />
            <Field
              id="clearance-z"
              label="Z方向の隙間"
              unit="mm"
              value={draft.clearanceZmm}
              issues={issues}
              issueField="zMm"
              inputMode="numeric"
              maxLength={5}
              help="0〜10,000の半角整数"
              onChange={(clearanceZmm) => setDraft({ ...draft, clearanceZmm })}
            />
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

type EditorMode = { readonly kind: "none" | "add" } | { readonly kind: "edit"; readonly id: string };

export function LegacyCargoManager({
  historyRevision,
  onBusyChange,
  onProjectCommit,
  project,
}: ProjectWorkspaceProps) {
  const [mode, setMode] = useState<EditorMode>({ kind: "none" });
  const [draft, setDraft] = useState<CargoDraft>(EMPTY_CARGO_DRAFT);
  const [originalDraft, setOriginalDraft] = useState<CargoDraft>(EMPTY_CARGO_DRAFT);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [pendingMode, setPendingMode] = useState<EditorMode>();
  const [deleteId, setDeleteId] = useState<string>();
  const [status, setStatus] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const appliedHistoryRevision = useRef(historyRevision);
  const dirty = JSON.stringify(draft) !== JSON.stringify(originalDraft);
  const selectedId = mode.kind === "edit" ? mode.id : undefined;
  const busy =
    mode.kind !== "none" || pendingMode !== undefined || deleteId !== undefined;

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (appliedHistoryRevision.current === historyRevision) {
      return;
    }
    appliedHistoryRevision.current = historyRevision;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setMode({ kind: "none" });
        setDraft(EMPTY_CARGO_DRAFT);
        setOriginalDraft(EMPTY_CARGO_DRAFT);
        setIssues([]);
        setPendingMode(undefined);
        setDeleteId(undefined);
        setStatus("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [historyRevision]);

  const activate = (nextMode: EditorMode) => {
    const target =
      nextMode.kind === "edit"
        ? project.cargoes.find((cargo) => cargo.id === nextMode.id)
        : undefined;
    if (nextMode.kind === "edit" && target === undefined) {
      setMode({ kind: "none" });
      setDraft(EMPTY_CARGO_DRAFT);
      setOriginalDraft(EMPTY_CARGO_DRAFT);
      setPendingMode(undefined);
      setDeleteId(undefined);
      setIssues([{ code: "command.cargo-not-found", path: "/cargoes" }]);
      setStatus("積荷の編集対象が見つからなかったため、編集を閉じました。");
      focusElement("cargo-add-button");
      return;
    }
    const nextDraft = target === undefined ? EMPTY_CARGO_DRAFT : cargoDraftFrom(target);
    setMode(nextMode);
    setDraft(nextDraft);
    setOriginalDraft(nextDraft);
    setIssues([]);
    setPendingMode(undefined);
    setDeleteId(undefined);
    setStatus(nextMode.kind === "add" ? "積荷の追加フォームを開きました。" : "積荷の編集フォームを開きました。");
    focusElement("cargo-name");
  };

  const requestMode = (nextMode: EditorMode) => {
    if (mode.kind !== "none" && dirty) {
      setPendingMode(nextMode);
      setStatus("未保存の積荷入力を破棄するか確認してください。");
      focusElement("cargo-pending-confirm");
      return;
    }
    activate(nextMode);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = saveCargo(project, draft, selectedId);
    if (!result.ok && result.issues.some((issue) => issue.code === "command.cargo-not-found")) {
      setMode({ kind: "none" });
      setDraft(EMPTY_CARGO_DRAFT);
      setOriginalDraft(EMPTY_CARGO_DRAFT);
      setPendingMode(undefined);
      setDeleteId(undefined);
      setIssues(result.issues);
      setStatus("積荷の編集対象が見つからなかったため、編集を閉じました。");
      focusElement("cargo-add-button");
      return;
    }
    const applied = applyResult(
      result,
      project,
      mode.kind === "add" ? "cargo.add" : "cargo.update",
      onProjectCommit,
      setIssues,
    );
    if (applied !== "success") {
      setStatus(
        applied === "stale"
          ? "CLPが更新されたため積荷を保存できませんでした。入力内容を確認してください。"
          : "",
      );
      focusFirstInvalid(formRef.current);
      return;
    }
    const returnFocusId = selectedId === undefined ? "cargo-add-button" : `cargo-edit-${selectedId}`;
    setStatus(
      result.ok && result.project === project
        ? "積荷に変更はありません。"
        : mode.kind === "add"
          ? "積荷を追加しました。"
          : "積荷の変更を保存しました。",
    );
    setMode({ kind: "none" });
    setDraft(EMPTY_CARGO_DRAFT);
    setOriginalDraft(EMPTY_CARGO_DRAFT);
    setPendingMode(undefined);
    setDeleteId(undefined);
    focusElement(returnFocusId);
  };

  const confirmDelete = (id: string) => {
    const result = deleteCargo(project, id);
    const applied = applyResult(
      result,
      project,
      "cargo.delete",
      onProjectCommit,
      setIssues,
    );
    if (applied === "success") {
      setDeleteId(undefined);
      setPendingMode(undefined);
      setStatus("積荷を削除しました。");
      if (selectedId === id) {
        setMode({ kind: "none" });
        setDraft(EMPTY_CARGO_DRAFT);
        setOriginalDraft(EMPTY_CARGO_DRAFT);
      }
      focusElement("cargo-add-button");
      return;
    }
    setStatus(
      applied === "stale"
        ? "CLPが更新されたため積荷を削除できませんでした。削除確認をやり直してください。"
        : "",
    );
    if (applied === "command-failure") {
      focusElement("cargo-errors");
    }
  };

  const cancelEditor = () => {
    const returnFocusId = selectedId === undefined ? "cargo-add-button" : `cargo-edit-${selectedId}`;
    setMode({ kind: "none" });
    setDraft(EMPTY_CARGO_DRAFT);
    setOriginalDraft(EMPTY_CARGO_DRAFT);
    setIssues([]);
    setPendingMode(undefined);
    setStatus("積荷の編集をキャンセルしました。");
    focusElement(returnFocusId);
  };

  const openDelete = (id: string) => {
    setDeleteId(id);
    setStatus("積荷の削除を確認してください。");
    focusElement(`cargo-delete-confirm-${id}`);
  };

  const cancelDelete = (id: string) => {
    setDeleteId(undefined);
    setStatus("積荷の削除をキャンセルしました。");
    focusElement(`cargo-delete-${id}`);
  };

  const uprightOnly = isUprightOnlyOrientationPolicy(draft.allowedOrientations);

  return (
    <section className="editor-card" aria-labelledby="cargo-title">
      <div className="section-heading">
        <div>
          <h2 id="cargo-title">積荷</h2>
          <p>{project.cargoes.length} / 1,000件</p>
        </div>
        <button
          id="cargo-add-button"
          type="button"
          className="secondary-button"
          disabled={project.cargoes.length >= 1000}
          onClick={() => requestMode({ kind: "add" })}
        >
          積荷を追加
        </button>
      </div>

      <p className="action-status" aria-live="polite" aria-atomic="true">{status}</p>

      <ErrorSummary id="cargo-errors" issues={issues} />

      {project.cargoes.length === 0 ? <p className="empty-state">積荷はまだありません。</p> : null}
      <ul className="entity-list" aria-label="積荷一覧">
        {project.cargoes.map((cargo) => (
          <li key={cargo.id}>
            <div>
              <strong>{cargo.name}</strong>
              <span>{cargo.dimensionsMm.lengthMm} × {cargo.dimensionsMm.widthMm} × {cargo.dimensionsMm.heightMm} mm</span>
            </div>
            <div className="button-row">
              <button id={`cargo-edit-${cargo.id}`} type="button" onClick={() => requestMode({ kind: "edit", id: cargo.id })}>
                編集: {cargo.name}
              </button>
              <button id={`cargo-delete-${cargo.id}`} type="button" onClick={() => openDelete(cargo.id)}>
                削除: {cargo.name}
              </button>
            </div>
            {deleteId === cargo.id ? (
              <div className="confirm-panel" role="alert">
                <p>この積荷を削除しますか。配置からの連鎖削除は行いません。</p>
                <div className="button-row">
                  <button id={`cargo-delete-confirm-${cargo.id}`} type="button" className="danger-button" onClick={() => confirmDelete(cargo.id)}>
                    削除を確定: {cargo.name}
                  </button>
                  <button type="button" onClick={() => cancelDelete(cargo.id)}>
                    削除をやめる: {cargo.name}
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {pendingMode === undefined ? null : (
        <div className="confirm-panel" role="alert">
          <p>未保存の積荷入力があります。破棄して切り替えますか。</p>
          <div className="button-row">
            <button id="cargo-pending-confirm" type="button" onClick={() => activate(pendingMode)}>未保存入力を破棄して切り替える</button>
            <button type="button" onClick={() => { setPendingMode(undefined); setStatus("積荷の編集を続けます。"); focusElement("cargo-name"); }}>積荷の編集を続ける</button>
          </div>
        </div>
      )}

      {mode.kind === "none" ? null : (
        <form ref={formRef} className="detail-form" onSubmit={submit} noValidate>
          <fieldset>
            <legend>{mode.kind === "add" ? "積荷を追加" : "積荷を編集"}</legend>
            <Field id="cargo-name" label="積荷名" value={draft.name} issues={issues} issueField="name" maxLength={120} onChange={(name) => setDraft({ ...draft, name })} />
            <div className="dimension-grid">
              <Field id="cargo-length" label="長さ" unit="mm" help="1〜100,000の半角整数" maxLength={6} value={draft.lengthMm} issues={issues} issueField="lengthMm" inputMode="numeric" onChange={(lengthMm) => setDraft({ ...draft, lengthMm })} />
              <Field id="cargo-width" label="幅" unit="mm" help="1〜100,000の半角整数" maxLength={6} value={draft.widthMm} issues={issues} issueField="widthMm" inputMode="numeric" onChange={(widthMm) => setDraft({ ...draft, widthMm })} />
              <Field id="cargo-height" label="高さ" unit="mm" help="1〜100,000の半角整数" maxLength={6} value={draft.heightMm} issues={issues} issueField="heightMm" inputMode="numeric" onChange={(heightMm) => setDraft({ ...draft, heightMm })} />
            </div>
            <Field id="cargo-mass" label="重量" unit="kg" help="0.001〜100,000 kg、小数3桁まで" maxLength={10} value={draft.massKg} issues={issues} issueField="massGrams" inputMode="decimal" onChange={(massKg) => setDraft({ ...draft, massKg })} />
          </fieldset>
          <fieldset>
            <legend>取扱い</legend>
            <label className="check-row check-row--emphasis">
              <input
                type="checkbox"
                checked={uprightOnly}
                onChange={(event) => {
                  setDraft({
                    ...draft,
                    allowedOrientations: orientationsForUprightPolicy(event.target.checked),
                  });
                }}
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
            <p className="field-help warning-copy">幾何判定用です。強度・安定性は未確認です。</p>
          </fieldset>
          <div className="button-row">
            <button className="primary-button" type="submit">{mode.kind === "add" ? "積荷を保存" : `積荷の変更を保存: ${project.cargoes.find((cargo) => cargo.id === selectedId)?.name ?? "選択中"}`}</button>
            <button type="button" onClick={cancelEditor}>積荷編集をキャンセル</button>
          </div>
        </form>
      )}
    </section>
  );
}

function CompactCargoManager({
  externalInteractionActive = false,
  onOpenCargoEditor,
  project,
}: ProjectWorkspaceProps) {
  return (
    <section className="editor-card editor-card--compact" aria-labelledby="cargo-title">
      <div className="section-heading">
        <div>
          <h2 id="cargo-title">積荷</h2>
          <p>{project.cargoes.length} / 1,000件</p>
        </div>
        <button
          id="cargo-add-button"
          type="button"
          className="secondary-button"
          aria-disabled={
            externalInteractionActive || project.cargoes.length >= 1000
              ? true
              : undefined
          }
          onClick={() => {
            if (!externalInteractionActive && project.cargoes.length < 1000) {
              onOpenCargoEditor?.({ kind: "add" });
            }
          }}
        >
          積荷を追加
        </button>
      </div>
      <p className="empty-state">
        積荷の選択・編集・削除は3D表示内の「操作する積荷」と固定操作欄から行います。
      </p>
    </section>
  );
}

function ContainerManager({
  historyRevision,
  onBusyChange,
  onProjectCommit,
  project,
}: ProjectWorkspaceProps) {
  const [mode, setMode] = useState<EditorMode>({ kind: "none" });
  const [draft, setDraft] = useState<ContainerDraft>(EMPTY_CONTAINER_DRAFT);
  const [originalDraft, setOriginalDraft] = useState<ContainerDraft>(EMPTY_CONTAINER_DRAFT);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [pendingMode, setPendingMode] = useState<EditorMode>();
  const [deleteId, setDeleteId] = useState<string>();
  const [status, setStatus] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const appliedHistoryRevision = useRef(historyRevision);
  const dirty = JSON.stringify(draft) !== JSON.stringify(originalDraft);
  const selectedId = mode.kind === "edit" ? mode.id : undefined;
  const busy =
    mode.kind !== "none" || pendingMode !== undefined || deleteId !== undefined;

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (appliedHistoryRevision.current === historyRevision) {
      return;
    }
    appliedHistoryRevision.current = historyRevision;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setMode({ kind: "none" });
        setDraft(EMPTY_CONTAINER_DRAFT);
        setOriginalDraft(EMPTY_CONTAINER_DRAFT);
        setIssues([]);
        setPendingMode(undefined);
        setDeleteId(undefined);
        setStatus("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [historyRevision]);

  const activate = (nextMode: EditorMode) => {
    const target =
      nextMode.kind === "edit"
        ? project.containers.find((container) => container.id === nextMode.id)
        : undefined;
    if (nextMode.kind === "edit" && target === undefined) {
      setMode({ kind: "none" });
      setDraft(EMPTY_CONTAINER_DRAFT);
      setOriginalDraft(EMPTY_CONTAINER_DRAFT);
      setPendingMode(undefined);
      setDeleteId(undefined);
      setIssues([{ code: "command.container-not-found", path: "/containers" }]);
      setStatus("候補の編集対象が見つからなかったため、編集を閉じました。");
      focusElement("container-add-button");
      return;
    }
    const nextDraft = target === undefined ? EMPTY_CONTAINER_DRAFT : containerDraftFrom(target);
    setMode(nextMode);
    setDraft(nextDraft);
    setOriginalDraft(nextDraft);
    setIssues([]);
    setPendingMode(undefined);
    setDeleteId(undefined);
    setStatus(nextMode.kind === "add" ? "候補の追加フォームを開きました。" : "候補の編集フォームを開きました。");
    focusElement("container-name");
  };
  const requestMode = (nextMode: EditorMode) => {
    if (mode.kind !== "none" && dirty) {
      setPendingMode(nextMode);
      setStatus("未保存の候補入力を破棄するか確認してください。");
      focusElement("container-pending-confirm");
      return;
    }
    activate(nextMode);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = saveContainer(project, draft, selectedId);
    if (!result.ok && result.issues.some((issue) => issue.code === "command.container-not-found")) {
      setMode({ kind: "none" });
      setDraft(EMPTY_CONTAINER_DRAFT);
      setOriginalDraft(EMPTY_CONTAINER_DRAFT);
      setPendingMode(undefined);
      setDeleteId(undefined);
      setIssues(result.issues);
      setStatus("候補の編集対象が見つからなかったため、編集を閉じました。");
      focusElement("container-add-button");
      return;
    }
    const applied = applyResult(
      result,
      project,
      mode.kind === "add" ? "container.add" : "container.update",
      onProjectCommit,
      setIssues,
    );
    if (applied !== "success") {
      setStatus(
        applied === "stale"
          ? "CLPが更新されたため候補を保存できませんでした。入力内容を確認してください。"
          : "",
      );
      focusFirstInvalid(formRef.current);
      return;
    }
    const returnFocusId =
      selectedId === undefined ? "container-add-button" : `container-edit-${selectedId}`;
    setStatus(
      result.ok && result.project === project
        ? "候補に変更はありません。"
        : mode.kind === "add"
          ? "候補を追加しました。"
          : "候補の変更を保存しました。",
    );
    setMode({ kind: "none" });
    setDraft(EMPTY_CONTAINER_DRAFT);
    setOriginalDraft(EMPTY_CONTAINER_DRAFT);
    setPendingMode(undefined);
    setDeleteId(undefined);
    focusElement(returnFocusId);
  };
  const confirmDelete = (id: string) => {
    const result = deleteContainer(project, id);
    const applied = applyResult(
      result,
      project,
      "container.delete",
      onProjectCommit,
      setIssues,
    );
    if (applied === "success") {
      setDeleteId(undefined);
      setPendingMode(undefined);
      setStatus("候補を削除しました。");
      if (selectedId === id) {
        setMode({ kind: "none" });
        setDraft(EMPTY_CONTAINER_DRAFT);
        setOriginalDraft(EMPTY_CONTAINER_DRAFT);
      }
      focusElement("container-add-button");
      return;
    }
    setStatus(
      applied === "stale"
        ? "CLPが更新されたため候補を削除できませんでした。削除確認をやり直してください。"
        : "",
    );
    if (applied === "command-failure") {
      focusElement("container-errors");
    }
  };

  const cancelEditor = () => {
    const returnFocusId =
      selectedId === undefined ? "container-add-button" : `container-edit-${selectedId}`;
    setMode({ kind: "none" });
    setDraft(EMPTY_CONTAINER_DRAFT);
    setOriginalDraft(EMPTY_CONTAINER_DRAFT);
    setIssues([]);
    setPendingMode(undefined);
    setStatus("候補の編集をキャンセルしました。");
    focusElement(returnFocusId);
  };

  const openDelete = (id: string) => {
    setDeleteId(id);
    setStatus("候補の削除を確認してください。");
    focusElement(`container-delete-confirm-${id}`);
  };

  const cancelDelete = (id: string) => {
    setDeleteId(undefined);
    setStatus("候補の削除をキャンセルしました。");
    focusElement(`container-delete-${id}`);
  };

  return (
    <section className="editor-card" aria-labelledby="container-title">
      <div className="section-heading">
        <div><h2 id="container-title">コンテナ・車両候補</h2><p>{project.containers.length} / 100件</p></div>
        <button id="container-add-button" type="button" className="secondary-button" disabled={project.containers.length >= 100} onClick={() => requestMode({ kind: "add" })}>候補を追加</button>
      </div>
      <p className="action-status" aria-live="polite" aria-atomic="true">{status}</p>
      <ErrorSummary id="container-errors" issues={issues} />
      {project.containers.length === 0 ? <p className="empty-state">候補はまだありません。</p> : null}
      <ul className="entity-list" aria-label="候補一覧">
        {project.containers.map((container) => (
          <li key={container.id}>
            <div><strong>{container.name}</strong><span>内部 {container.internalDimensionsMm.lengthMm} × {container.internalDimensionsMm.widthMm} × {container.internalDimensionsMm.heightMm} mm</span></div>
            <div className="button-row">
              <button id={`container-edit-${container.id}`} type="button" onClick={() => requestMode({ kind: "edit", id: container.id })}>編集: {container.name}</button>
              <button id={`container-delete-${container.id}`} type="button" onClick={() => openDelete(container.id)}>削除: {container.name}</button>
            </div>
            {deleteId === container.id ? (
              <div className="confirm-panel" role="alert">
                <p>この候補を削除しますか。配置からの連鎖削除は行いません。</p>
                <div className="button-row">
                  <button id={`container-delete-confirm-${container.id}`} type="button" className="danger-button" onClick={() => confirmDelete(container.id)}>削除を確定: {container.name}</button>
                  <button type="button" onClick={() => cancelDelete(container.id)}>削除をやめる: {container.name}</button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {pendingMode === undefined ? null : (
        <div className="confirm-panel" role="alert">
          <p>未保存の候補入力があります。破棄して切り替えますか。</p>
          <div className="button-row">
            <button id="container-pending-confirm" type="button" onClick={() => activate(pendingMode)}>未保存入力を破棄して切り替える</button>
            <button type="button" onClick={() => { setPendingMode(undefined); setStatus("候補の編集を続けます。"); focusElement("container-name"); }}>候補の編集を続ける</button>
          </div>
        </div>
      )}
      {mode.kind === "none" ? null : (
        <form ref={formRef} className="detail-form" onSubmit={submit} noValidate>
          <fieldset>
            <legend>{mode.kind === "add" ? "候補を追加" : "候補を編集"}</legend>
            <Field id="container-name" label="候補名" value={draft.name} issues={issues} issueField="name" maxLength={120} onChange={(name) => setDraft({ ...draft, name })} />
            <div className="dimension-grid">
              <Field id="container-length" label="内部長さ" unit="mm" help="1〜100,000の半角整数" maxLength={6} value={draft.internalLengthMm} issues={issues} issueField="internalDimensionsMm/lengthMm" inputMode="numeric" onChange={(internalLengthMm) => setDraft({ ...draft, internalLengthMm })} />
              <Field id="container-width" label="内部幅" unit="mm" help="1〜100,000の半角整数" maxLength={6} value={draft.internalWidthMm} issues={issues} issueField="internalDimensionsMm/widthMm" inputMode="numeric" onChange={(internalWidthMm) => setDraft({ ...draft, internalWidthMm })} />
              <Field id="container-height" label="内部高さ" unit="mm" help="1〜100,000の半角整数" maxLength={6} value={draft.internalHeightMm} issues={issues} issueField="internalDimensionsMm/heightMm" inputMode="numeric" onChange={(internalHeightMm) => setDraft({ ...draft, internalHeightMm })} />
            </div>
          </fieldset>
          <fieldset>
            <legend>負X側の矩形開口</legend>
            <div className="dimension-grid">
              <Field id="opening-width" label="開口幅" unit="mm" help="1〜100,000の半角整数。内部幅以下" maxLength={6} value={draft.openingWidthMm} issues={issues} issueField="openingMm/widthMm" inputMode="numeric" onChange={(openingWidthMm) => setDraft({ ...draft, openingWidthMm })} />
              <Field id="opening-height" label="開口高さ" unit="mm" help="1〜100,000の半角整数。内部高さ以下" maxLength={6} value={draft.openingHeightMm} issues={issues} issueField="openingMm/heightMm" inputMode="numeric" onChange={(openingHeightMm) => setDraft({ ...draft, openingHeightMm })} />
            </div>
            <p className="field-help warning-copy">開口内回転や斜め通過を含む搬入経路は未確認です。</p>
          </fieldset>
          <fieldset>
            <legend>耐荷重</legend>
            <Field id="container-payload" label="総耐荷重" unit="kg" help="0.001〜100,000 kg、小数3桁まで" maxLength={10} value={draft.payloadCapacityKg} issues={issues} issueField="payloadCapacityGrams" inputMode="decimal" onChange={(payloadCapacityKg) => setDraft({ ...draft, payloadCapacityKg })} />
          </fieldset>
          <div className="button-row">
            <button className="primary-button" type="submit">{mode.kind === "add" ? "候補を保存" : `候補の変更を保存: ${project.containers.find((container) => container.id === selectedId)?.name ?? "選択中"}`}</button>
            <button type="button" onClick={cancelEditor}>候補編集をキャンセル</button>
          </div>
        </form>
      )}
    </section>
  );
}

export function ProjectWorkspace({
  externalInteractionActive,
  historyRevision,
  onBusyChange,
  onOpenCargoEditor,
  onProjectCommit,
  project,
}: ProjectWorkspaceProps) {
  const [busyEditors, setBusyEditors] = useState({
    cargo: false,
    container: false,
  });
  const reportEditorBusy = useCallback(
    (editor: keyof typeof busyEditors, busy: boolean) => {
      setBusyEditors((current) =>
        current[editor] === busy ? current : { ...current, [editor]: busy },
      );
    },
    [],
  );
  const reportCargoBusy = useCallback(
    (busy: boolean) => reportEditorBusy("cargo", busy),
    [reportEditorBusy],
  );
  const reportContainerBusy = useCallback(
    (busy: boolean) => reportEditorBusy("container", busy),
    [reportEditorBusy],
  );
  const busy = busyEditors.cargo || busyEditors.container;

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  const summary = useMemo(
    () => `積荷 ${project.cargoes.length}件、候補 ${project.containers.length}件、配置 ${project.placements.length}件`,
    [project],
  );
  return (
    <section className="workspace" aria-labelledby="workspace-title">
      <div className="workspace__heading">
        <div><p className="eyebrow">CLP INPUT</p><h2 id="workspace-title">CLP入力</h2></div>
        <p aria-live="polite">{summary}</p>
      </div>
      <aside className="privacy-note" aria-label="入力データの注意">
        実在する顧客名、個人情報、秘密情報、実貨物や搬送記録を入力しないでください。
      </aside>
      <p className="visually-hidden" data-testid="canonical-project-settings">
        確定済み: {project.name} / 隙間 X {project.clearancesMm.xMm}・Y {project.clearancesMm.yMm}・Z {project.clearancesMm.zMm} mm
      </p>
      <div className="entity-columns">
        <CompactCargoManager
          externalInteractionActive={externalInteractionActive}
          historyRevision={historyRevision}
          onBusyChange={reportCargoBusy}
          onOpenCargoEditor={onOpenCargoEditor}
          onProjectCommit={onProjectCommit}
          project={project}
        />
        <ContainerManager
          historyRevision={historyRevision}
          onBusyChange={reportContainerBusy}
          onProjectCommit={onProjectCommit}
          project={project}
        />
      </div>
    </section>
  );
}
