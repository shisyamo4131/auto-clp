import { useEffect, useMemo, useState } from "react";

import type { Project } from "../domain/model";
import { PHYSICAL_VALIDATION_REASON_PAGE_SIZE } from "../workers/physical-validation-worker-protocol";
import {
  createPhysicalValidationLabelMaps,
  toPhysicalValidationReasonViews,
  toPhysicalValidationSummaryView,
  type PhysicalValidationReasonView,
  type PhysicalValidationViewStatus,
} from "./physical-validation-view";
import {
  type PhysicalValidationReasonPageSnapshot,
  type PhysicalValidationWorkerController,
  type PhysicalValidationWorkerSnapshot,
} from "./usePhysicalValidationWorker";
import { ModalShell } from "./ModalShell";

interface PhysicalValidationPanelProps {
  readonly controller: PhysicalValidationWorkerController;
  readonly onClose: () => void;
  readonly onOpenUsageRequirements: () => void;
  readonly open: boolean;
  readonly project: Project;
}

interface PhysicalValidationLampProps {
  readonly controller: PhysicalValidationWorkerController;
  readonly disabled?: boolean;
  readonly onOpen: () => void;
  readonly project: Project;
}

interface ReasonGroupProps {
  readonly heading: string;
  readonly loading: boolean;
  readonly onOffsetChange: (offset: number) => void;
  readonly page?: PhysicalValidationReasonPageSnapshot;
  readonly reasons: readonly PhysicalValidationReasonView[];
  readonly requestedOffset: number;
  readonly total: number;
}

interface PageSelection {
  readonly generation: number;
  readonly invalidOffset: number;
  readonly unverifiedOffset: number;
}

interface PanelSummary {
  readonly status: PhysicalValidationViewStatus | "loading";
  readonly statusLabel: string;
  readonly summary: string;
  readonly unavailableTargetLabel?: string;
}

function panelSummary(
  snapshot: PhysicalValidationWorkerSnapshot,
  labels: ReturnType<typeof createPhysicalValidationLabelMaps>,
): PanelSummary {
  if (snapshot.phase === "none") {
    return {
      status: "none",
      statusLabel: "判定対象なし",
      summary: "判定対象なし：コンテナを追加してください。",
    };
  }
  if (snapshot.phase === "loading") {
    return {
      status: "loading",
      statusLabel: "判定中",
      summary: "判定中：保存済み配置の物理判定を計算しています。",
    };
  }
  if (snapshot.phase === "transport-error") {
    return {
      status: "unavailable",
      statusLabel: "判定不能",
      summary:
        "判定不能：物理判定の処理を開始または完了できませんでした。再試行してください。",
    };
  }
  return toPhysicalValidationSummaryView(labels, snapshot.summary);
}

export function PhysicalValidationLamp({
  controller,
  disabled = false,
  onOpen,
  project,
}: PhysicalValidationLampProps) {
  const labels = useMemo(() => createPhysicalValidationLabelMaps(project), [project]);
  const summary = useMemo(
    () => panelSummary(controller.snapshot, labels),
    [controller.snapshot, labels],
  );
  const ready = controller.snapshot.phase === "ready" ? controller.snapshot.summary : undefined;
  const invalidCount = ready?.kind === "evaluated" ? ready.invalidCount : 0;
  const unverifiedCount = ready?.kind === "evaluated" ? ready.unverifiedCount : 0;
  const lampStatus =
    summary.status === "loading" || summary.status === "none"
      ? "neutral"
      : summary.status === "valid"
        ? "valid"
        : summary.status === "unverified"
          ? "unverified"
          : "invalid";
  const statusLabel = summary.status === "valid"
    ? "実装済み確認項目内で問題なし"
    : summary.statusLabel;
  const icon = summary.status === "none"
    ? "○"
    : summary.status === "loading"
      ? "↻"
      : summary.status === "valid"
        ? "✓"
        : summary.status === "unverified"
          ? "△"
          : summary.status === "unavailable"
            ? "×"
            : "!";
  return (
    <button
      id="physical-validation-lamp"
      className="physical-validation-lamp"
      type="button"
      data-status={lampStatus}
      aria-haspopup="dialog"
      aria-disabled={disabled ? true : undefined}
      aria-label={`物理判定: ${statusLabel}。不適合${invalidCount}件、未確認${unverifiedCount}件。詳細を開く`}
      title={`${statusLabel} — 不適合${invalidCount}件・未確認${unverifiedCount}件。詳細を開く`}
      onClick={() => {
        if (!disabled) onOpen();
      }}
    >
      <span aria-hidden="true" className="physical-validation-lamp__icon">{icon}</span>
    </button>
  );
}

function ReasonGroup({
  heading,
  loading,
  onOffsetChange,
  page,
  reasons,
  requestedOffset,
  total,
}: ReasonGroupProps) {
  const response = page?.response;
  const visibleOffset = response?.offset ?? requestedOffset;
  const pageCount = Math.ceil(total / PHYSICAL_VALIDATION_REASON_PAGE_SIZE);
  const currentPage = Math.floor(requestedOffset / PHYSICAL_VALIDATION_REASON_PAGE_SIZE);

  return (
    <section className="physical-validation__group" aria-label={`${heading}理由`}>
      <h5>{heading}理由（{total}件）</h5>
      {response === undefined ? (
        <p className="physical-validation__page-loading">理由を読み込んでいます。</p>
      ) : (
        <ol className="physical-validation__reasons" start={visibleOffset + 1}>
          {reasons.map((reason) => (
            <li
              className={`physical-validation__reason physical-validation__reason--${reason.status}`}
              key={reason.key}
            >
              <span className="physical-validation__reason-status">
                {reason.statusLabel}
              </span>
              <p>{reason.message}</p>
              <dl>
                <div>
                  <dt>対象</dt>
                  <dd>{reason.targetLabel}</dd>
                </div>
                {reason.relatedCargoLabels.length === 0 ? null : (
                  <div>
                    <dt>関連積荷</dt>
                    <dd>{reason.relatedCargoLabels.join("、")}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ol>
      )}
      {pageCount <= 1 ? null : (
        <nav className="physical-validation__pagination" aria-label={`${heading}理由のページ`}>
          <span>
            {visibleOffset + 1}〜
            {Math.min(
              visibleOffset + PHYSICAL_VALIDATION_REASON_PAGE_SIZE,
              total,
            )} / {total}件
          </span>
          <div className="button-row">
            <button
              type="button"
              disabled={loading || currentPage === 0}
              onClick={() =>
                onOffsetChange(
                  Math.max(0, requestedOffset - PHYSICAL_VALIDATION_REASON_PAGE_SIZE),
                )
              }
            >
              前の{heading}理由
            </button>
            <button
              type="button"
              disabled={loading || currentPage >= pageCount - 1}
              onClick={() =>
                onOffsetChange(
                  requestedOffset + PHYSICAL_VALIDATION_REASON_PAGE_SIZE,
                )
              }
            >
              次の{heading}理由
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}

export function PhysicalValidationPanel({
  controller,
  onClose,
  onOpenUsageRequirements,
  open,
  project,
}: PhysicalValidationPanelProps) {
  const { requestReasonPage, retry, snapshot } = controller;
  const [pageSelection, setPageSelection] = useState<PageSelection>({
    generation: -1,
    invalidOffset: 0,
    unverifiedOffset: 0,
  });
  const labels = useMemo(() => createPhysicalValidationLabelMaps(project), [project]);
  const summary = useMemo(() => panelSummary(snapshot, labels), [labels, snapshot]);
  const readySnapshot = snapshot.phase === "ready" ? snapshot : undefined;
  const generation = readySnapshot?.generation ?? -1;
  const invalidOffset =
    pageSelection.generation === generation ? pageSelection.invalidOffset : 0;
  const unverifiedOffset =
    pageSelection.generation === generation ? pageSelection.unverifiedOffset : 0;
  const invalidPage = readySnapshot?.invalidPage;
  const unverifiedPage = readySnapshot?.unverifiedPage;
  const invalidReasons = useMemo(
    () =>
      toPhysicalValidationReasonViews(
        labels,
        invalidPage?.response?.reasons ?? [],
      ),
    [invalidPage?.response, labels],
  );
  const unverifiedReasons = useMemo(
    () =>
      toPhysicalValidationReasonViews(
        labels,
        unverifiedPage?.response?.reasons ?? [],
      ),
    [labels, unverifiedPage?.response],
  );

  useEffect(() => {
    if (
      readySnapshot?.summary.kind === "evaluated" &&
      readySnapshot.summary.invalidCount > 0
    ) {
      requestReasonPage("invalid", invalidOffset);
    }
  }, [generation, invalidOffset, readySnapshot?.summary, requestReasonPage]);

  useEffect(() => {
    if (
      readySnapshot?.summary.kind === "evaluated" &&
      readySnapshot.summary.unverifiedCount > 0
    ) {
      requestReasonPage("unverified", unverifiedOffset);
    }
  }, [generation, readySnapshot?.summary, requestReasonPage, unverifiedOffset]);

  const reasonsLoading = Boolean(invalidPage?.loading || unverifiedPage?.loading);
  const busy = snapshot.phase === "loading" || reasonsLoading;

  if (!open) return null;

  return (
    <ModalShell
      fallbackFocusIds={["physical-validation-lamp"]}
      onRequestClose={onClose}
      title="物理判定"
    >
    <section
      className="physical-validation"
      aria-labelledby="physical-validation-title"
      aria-busy={busy}
    >
      <div className="physical-validation__heading">
        <h4 id="physical-validation-title">物理判定</h4>
        <span className={`physical-validation__badge physical-validation__badge--${summary.status}`}>
          {summary.statusLabel}
        </span>
      </div>

      <p
        className="physical-validation__summary"
        aria-live="polite"
        aria-atomic="true"
      >
        {summary.summary}
      </p>

      {summary.unavailableTargetLabel === undefined ? null : (
        <p className="physical-validation__target">
          判定対象: {summary.unavailableTargetLabel}
        </p>
      )}

      {snapshot.phase === "transport-error" ? (
        <button className="secondary-button" type="button" onClick={retry}>
          物理判定を再試行
        </button>
      ) : null}

      {readySnapshot?.summary.kind === "evaluated" &&
      readySnapshot.summary.invalidCount > 0 ? (
        <ReasonGroup
          heading="不適合"
          loading={invalidPage?.loading ?? true}
          page={invalidPage}
          reasons={invalidReasons}
          requestedOffset={invalidOffset}
          total={readySnapshot.summary.invalidCount}
          onOffsetChange={(offset) =>
            setPageSelection((current) => ({
              generation,
              invalidOffset: offset,
              unverifiedOffset:
                current.generation === generation ? current.unverifiedOffset : 0,
            }))
          }
        />
      ) : null}

      {readySnapshot?.summary.kind === "evaluated" &&
      readySnapshot.summary.unverifiedCount > 0 ? (
        <ReasonGroup
          heading="未確認"
          loading={unverifiedPage?.loading ?? true}
          page={unverifiedPage}
          reasons={unverifiedReasons}
          requestedOffset={unverifiedOffset}
          total={readySnapshot.summary.unverifiedCount}
          onOffsetChange={(offset) =>
            setPageSelection((current) => ({
              generation,
              invalidOffset:
                current.generation === generation ? current.invalidOffset : 0,
              unverifiedOffset: offset,
            }))
          }
        />
      ) : null}

      <p className="physical-validation__disclaimer">
        この判定は実装済み確認項目だけを示し、積載可能性や実積載の安全性を保証しません。
        <button className="link-button" type="button" onClick={onOpenUsageRequirements}>
          使用上の重要事項を確認
        </button>
      </p>
    </section>
    </ModalShell>
  );
}
