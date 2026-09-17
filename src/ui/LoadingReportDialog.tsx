import { useMemo } from "react";

import {
  createLoadingReportSnapshot,
  type LoadingReportDependencySnapshot,
} from "../application/loading-report";
import type {
  LoadingSequencePrecedenceReason,
  LoadingSequenceUnavailableReason,
} from "../domain/loading-sequence";
import type { Project } from "../domain/model";
import { toPhysicalValidationView } from "./physical-validation-view";
import { ModalShell } from "./ModalShell";

interface LoadingReportDialogProps {
  readonly containerId?: string;
  readonly onClose: () => void;
  readonly open: boolean;
  readonly project: Project;
}

const UNAVAILABLE_REASON_COPY = {
  "loading-sequence.container-reference-invalid":
    "選択中コンテナを一意に特定できません。コンテナを選び直してください。",
  "loading-sequence.cargo-reference-invalid":
    "配置と積荷の参照に不整合があるため、積込順を計算できません。",
  "loading-sequence.geometry-calculation-unavailable":
    "向き・寸法・座標から積荷の範囲を安全に計算できません。",
  "loading-sequence.positive-volume-overlap":
    "積荷同士が立体的に重なっているため、積込順を確定できません。",
  "loading-sequence.support-contact-missing":
    "床より上の積荷に接触する支持物を特定できないため、積込順を確定できません。",
  "loading-sequence.precedence-cycle":
    "支持関係と搬入経路の先行関係が循環しているため、積込順を確定できません。",
} satisfies Record<LoadingSequenceUnavailableReason["code"], string>;

const PRECEDENCE_REASON_COPY = {
  access: "直線搬入帯の確保",
  support: "上段積荷の支持",
} satisfies Record<LoadingSequencePrecedenceReason, string>;

function gramsToKilograms(grams: number): string {
  const whole = Math.floor(grams / 1000);
  const fraction = String(grams % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction.length === 0 ? String(whole) : `${whole}.${fraction}`;
}

function cargoLabel(project: Project, cargoId: string): string {
  const cargo = project.cargoes.find((candidate) => candidate.id === cargoId);
  return `${cargo?.name ?? "不明な積荷"}（ID: ${cargoId || "空文字"}）`;
}

function dependencyLabel(
  project: Project,
  dependency: LoadingReportDependencySnapshot,
): string {
  return `${cargoLabel(project, dependency.cargoId)} — ${dependency.reasons
    .map((reason) => PRECEDENCE_REASON_COPY[reason])
    .join("・")}`;
}

function LoadingReportIcon() {
  return (
    <svg
      aria-hidden="true"
      className="loading-report-button__icon"
      data-icon="file-document-outline"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M14,4L18,8H14V4M6,20V4H12V10H18V20H6M8,12V14H16V12H8M8,16V18H13V16H8Z"
      />
    </svg>
  );
}

export function LoadingReportButton({
  disabled = false,
  onOpen,
}: {
  readonly disabled?: boolean;
  readonly onOpen: () => void;
}) {
  return (
    <button
      id="loading-report-button"
      className="loading-report-button"
      type="button"
      aria-haspopup="dialog"
      aria-disabled={disabled ? true : undefined}
      aria-label="積込順とPDF帳票を確認"
      title="積込順とPDF帳票を確認"
      onClick={() => {
        if (!disabled) onOpen();
      }}
    >
      <LoadingReportIcon />
    </button>
  );
}

export function LoadingReportDialog({
  containerId,
  onClose,
  open,
  project,
}: LoadingReportDialogProps) {
  const snapshot = useMemo(
    () =>
      open && containerId !== undefined
        ? createLoadingReportSnapshot(project, containerId)
        : undefined,
    [containerId, open, project],
  );
  const physicalView = useMemo(
    () =>
      snapshot === undefined
        ? undefined
        : toPhysicalValidationView(project, snapshot.physicalValidation),
    [project, snapshot],
  );

  if (!open) return null;

  return (
    <ModalShell
      fallbackFocusIds={["loading-report-button"]}
      onRequestClose={onClose}
      title="積込順・PDF帳票"
    >
      <section className="loading-report" aria-label="積込順提案とPDF帳票">
        {snapshot === undefined ? (
          <p className="loading-report__unavailable" role="alert">
            選択中コンテナがないため、積込順を確認できません。
          </p>
        ) : (
          <>
            <dl className="loading-report__identity">
              <div><dt>CLP</dt><dd>{snapshot.projectName}</dd></div>
              <div><dt>コンテナ</dt><dd>{snapshot.containerName ?? "不明なコンテナ"}</dd></div>
            </dl>

            <div className="loading-report__notice">
              <strong>限定モデルによる一提案です</strong>
              <p>
                現在の向きを保ち、開口側から最終Y/Zへ直線搬入する前提で、支持物と奥側の積荷を優先します。
              </p>
            </div>

            {snapshot.status === "empty" ? (
              <p className="loading-report__empty">
                このコンテナには配置済みの積荷がありません。積荷を配置してから確認してください。
              </p>
            ) : snapshot.status === "unavailable" ? (
              <section className="loading-report__unavailable" role="alert">
                <h3>積込順を提案できません</h3>
                <p>{UNAVAILABLE_REASON_COPY[snapshot.reason.code]}</p>
                {snapshot.reason.relatedCargoIds.length === 0 ? null : (
                  <p>
                    関係積荷: {snapshot.reason.relatedCargoIds
                      .map((cargoId) => cargoLabel(project, cargoId))
                      .join("、")}
                  </p>
                )}
              </section>
            ) : (
              <>
                <section className="loading-report__sequence" aria-labelledby="loading-report-sequence-title">
                  <h3 id="loading-report-sequence-title">提案する積込順</h3>
                  <ol>
                    {snapshot.cargoes.map((cargo) => (
                      <li key={cargo.cargoId}>
                        <div className="loading-report__cargo-heading">
                          <span aria-label={`積込順${cargo.sequenceNumber}`}>{cargo.sequenceNumber}</span>
                          <strong>{cargo.name}</strong>
                        </div>
                        <dl>
                          <div><dt>ID</dt><dd>{cargo.cargoId}</dd></div>
                          <div>
                            <dt>現在向き寸法</dt>
                            <dd>{cargo.orientedDimensionsMm.xMm} × {cargo.orientedDimensionsMm.yMm} × {cargo.orientedDimensionsMm.zMm} mm</dd>
                          </div>
                          <div><dt>重量</dt><dd>{gramsToKilograms(cargo.massGrams)} kg</dd></div>
                        </dl>
                        <p className="loading-report__dependencies">
                          {cargo.dependencies.length === 0
                            ? "先行条件なし"
                            : `先に積み込む積荷: ${cargo.dependencies
                                .map((dependency) => dependencyLabel(project, dependency))
                                .join("、")}`}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>

                {snapshot.warnings.length === 0 ? null : (
                  <section className="loading-report__warnings" aria-label="積込順の未確認事項">
                    <h3>未確認事項</h3>
                    <ul>
                      {snapshot.warnings.map((warning) => (
                        <li key={`${warning.targetCargoId}-${warning.relatedCargoIds.join("-")}`}>
                          {cargoLabel(project, warning.targetCargoId)}は複数の接触支持物を使います。
                          支持位置、剛性、張り出し、許容支持間隔を確認してください。
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {physicalView === undefined ? null : (
              <section className="loading-report__physical" aria-label="現在配置の物理判定">
                <h3>現在配置の物理判定</h3>
                <p><strong>{physicalView.statusLabel}</strong> — {physicalView.summary}</p>
                {[...physicalView.invalidReasons, ...physicalView.unverifiedReasons].length === 0 ? null : (
                  <ul>
                    {[...physicalView.invalidReasons, ...physicalView.unverifiedReasons].map((reason) => (
                      <li key={reason.key}>
                        {reason.statusLabel}: {reason.targetLabel} — {reason.message}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section className="loading-report__limitations" aria-label="提案で評価しない事項">
              <h3>評価しない事項</h3>
              <p>
                搬送機器、作業空間、扉厚、斜路、旋回、吊り上げ、固縛、荷崩れ、荷下ろし順、目的地順、法令適合性、実作業の安全性は評価・保証しません。
              </p>
            </section>
          </>
        )}

        <div className="modal-shell__actions loading-report__actions">
          <button type="button" className="primary-button" disabled>
            PDFを出力
          </button>
          <p>番号付き5視点画像とPDF生成は次の実装フェーズで有効になります。</p>
        </div>
      </section>
    </ModalShell>
  );
}
