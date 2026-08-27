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
  usePhysicalValidationWorker,
  type PhysicalValidationReasonPageSnapshot,
  type PhysicalValidationWorkerSnapshot,
} from "./usePhysicalValidationWorker";

interface PhysicalValidationPanelProps {
  readonly containerId?: string;
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
      summary: "判定対象なし：候補コンテナを追加してください。",
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
  containerId,
  project,
}: PhysicalValidationPanelProps) {
  const { requestReasonPage, retry, snapshot } = usePhysicalValidationWorker(
    project,
    containerId,
  );
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

  return (
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
        この判定は計画支援です。完全な搬入経路、構造・安定性、重心、軸重、床面強度、荷崩れ、固縛、動荷重、法令適合性や実積載の安全性を保証しません。
      </p>
    </section>
  );
}
