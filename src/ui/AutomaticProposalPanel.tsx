import { useEffect, useMemo, useRef, useState } from "react";

import type { Project } from "../domain/model";
import type {
  AutomaticProposalApplyHandler,
  AutomaticProposalSessionContextReader,
} from "./automatic-proposal-session";
import {
  AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE,
  automaticProposalView,
  type AutomaticProposalViewPage,
} from "./automatic-proposal-view";
import { useAutomaticProposalSession } from "./useAutomaticProposalSession";

export interface AutomaticProposalPanelProps {
  readonly project: Project;
  readonly interactionGeneration: number;
  readonly startBlocked: boolean;
  readonly readContext: AutomaticProposalSessionContextReader;
  readonly applyProposal: AutomaticProposalApplyHandler;
}

interface PageSelection {
  readonly identity: number;
  readonly candidateOffset: number;
  readonly placementOffset: number;
  readonly unverifiedOffset: number;
}

interface PageControlsProps {
  readonly label: string;
  readonly page: AutomaticProposalViewPage<unknown>;
  readonly onOffsetChange: (offset: number) => void;
}

function PageControls({ label, page, onOffsetChange }: PageControlsProps) {
  if (!page.hasPrevious && !page.hasNext) {
    return null;
  }
  return (
    <nav className="automatic-proposal__pagination" aria-label={`${label}のページ`}>
      <span>
        {page.offset + 1}〜{page.offset + page.rows.length} / {page.total}件
      </span>
      <div className="button-row">
        <button
          type="button"
          disabled={!page.hasPrevious}
          onClick={() =>
            onOffsetChange(
              Math.max(0, page.offset - AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE),
            )
          }
        >
          前の{label}
        </button>
        <button
          type="button"
          disabled={!page.hasNext}
          onClick={() =>
            onOffsetChange(page.offset + AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE)
          }
        >
          次の{label}
        </button>
      </div>
    </nav>
  );
}

export function AutomaticProposalPanel({
  project,
  interactionGeneration,
  startBlocked,
  readContext,
  applyProposal,
}: AutomaticProposalPanelProps) {
  const { apply, cancel, retry, snapshot, start } = useAutomaticProposalSession({
    project,
    interactionGeneration,
    startBlocked,
    readContext,
    applyProposal,
  });
  const readyIdentity = snapshot.phase === "ready" ? snapshot.identity : -1;
  const [pageSelection, setPageSelection] = useState<PageSelection>({
    identity: -1,
    candidateOffset: 0,
    placementOffset: 0,
    unverifiedOffset: 0,
  });
  const [confirmationIdentity, setConfirmationIdentity] = useState<number>();
  const applyButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const offsets =
    pageSelection.identity === readyIdentity
      ? pageSelection
      : {
          identity: readyIdentity,
          candidateOffset: 0,
          placementOffset: 0,
          unverifiedOffset: 0,
        };
  const view = useMemo(
    () =>
      automaticProposalView(snapshot, project, {
        candidateOffset: offsets.candidateOffset,
        placementOffset: offsets.placementOffset,
        unverifiedOffset: offsets.unverifiedOffset,
      }),
    [offsets.candidateOffset, offsets.placementOffset, offsets.unverifiedOffset, project, snapshot],
  );
  const confirmationOpen =
    snapshot.phase === "ready" &&
    view.isApplicablePreview &&
    confirmationIdentity === snapshot.identity &&
    !startBlocked;
  const applyTerminal =
    snapshot.phase === "applied" ||
    snapshot.phase === "unchanged" ||
    snapshot.phase === "apply-failed" ||
    snapshot.phase === "blocked";

  useEffect(() => {
    if (confirmationOpen) {
      confirmButtonRef.current?.focus();
    }
  }, [confirmationOpen]);

  useEffect(() => {
    if (applyTerminal) {
      summaryRef.current?.focus();
    }
  }, [applyTerminal]);
  const updateOffset = (
    key: "candidateOffset" | "placementOffset" | "unverifiedOffset",
    offset: number,
  ) => {
    setPageSelection((current) => ({
      identity: readyIdentity,
      candidateOffset:
        key === "candidateOffset"
          ? offset
          : current.identity === readyIdentity
            ? current.candidateOffset
            : 0,
      placementOffset:
        key === "placementOffset"
          ? offset
          : current.identity === readyIdentity
            ? current.placementOffset
            : 0,
      unverifiedOffset:
        key === "unverifiedOffset"
          ? offset
          : current.identity === readyIdentity
            ? current.unverifiedOffset
            : 0,
    }));
  };

  return (
    <section
      className="automatic-proposal"
      aria-labelledby="automatic-proposal-title"
      aria-busy={snapshot.phase === "running" || snapshot.phase === "applying"}
      data-automatic-proposal-phase={view.phase}
    >
      <div className="automatic-proposal__heading">
        <div>
          <p className="eyebrow">DETERMINISTIC LOCAL SEARCH</p>
          <h2 id="automatic-proposal-title">{view.heading}</h2>
        </div>
        <span
          className={`automatic-proposal__badge automatic-proposal__badge--${view.tone}`}
        >
          {view.badge}
        </span>
      </div>

      <p
        ref={summaryRef}
        className="automatic-proposal__summary"
        aria-live="polite"
        aria-atomic="true"
        tabIndex={applyTerminal ? -1 : undefined}
      >
        {view.summary}
      </p>
      <p className="automatic-proposal__detail">{view.detail}</p>

      <div className="automatic-proposal__actions button-row">
        {snapshot.phase === "idle" ? (
          <button
            type="button"
            className="primary-button"
            disabled={startBlocked}
            aria-describedby={startBlocked ? "automatic-proposal-blocked" : undefined}
            onClick={start}
          >
            自動提案を開始
          </button>
        ) : null}
        {snapshot.phase === "running" ? (
          <button type="button" className="secondary-button" onClick={cancel}>
            探索を中止
          </button>
        ) : null}
        {snapshot.phase === "failed" ||
        snapshot.phase === "apply-failed" ||
        snapshot.phase === "blocked" ||
        snapshot.phase === "cancelled" ||
        snapshot.phase === "stale" ? (
          <button
            type="button"
            className="primary-button"
            disabled={startBlocked}
            aria-describedby={startBlocked ? "automatic-proposal-blocked" : undefined}
            onClick={retry}
          >
            現在のCLPで再試行
          </button>
        ) : null}
        {snapshot.phase === "ready" &&
        view.isApplicablePreview &&
        !confirmationOpen ? (
          <button
            ref={applyButtonRef}
            type="button"
            className="primary-button"
            disabled={startBlocked}
            aria-describedby={
              startBlocked ? "automatic-proposal-blocked" : undefined
            }
            onClick={() => setConfirmationIdentity(snapshot.identity)}
          >
            配置案を適用
          </button>
        ) : null}
      </div>
      {startBlocked && snapshot.phase !== "running" ? (
        <p id="automatic-proposal-blocked" className="automatic-proposal__blocked">
          未保存入力、削除確認、3D移動、または保存処理を完了してから開始してください。
        </p>
      ) : null}

      {confirmationOpen ? (
        <div
          key={snapshot.identity}
          className="confirm-panel automatic-proposal__confirmation"
          role="alert"
        >
          <strong>配置案をCLPへ一括適用しますか？</strong>
          <p>
            {project.placements.length > 0
              ? `現在の配置${project.placements.length}件を、${view.selectedContainerLabel ?? "配置先コンテナ"}への配置案${view.metrics.proposalPlacementCount}件で一括置換します。`
              : `${view.selectedContainerLabel ?? "配置先コンテナ"}への配置案${view.metrics.proposalPlacementCount}件を追加します。`}
            配置が変わる場合は、1回の取り消しで元へ戻せます。
          </p>
          {snapshot.result.status === "complete-with-cutoff" ? (
            <p className="warning-copy">
              より優先されるコンテナの探索が上限に達したため、この案が目的関数上の最良とは確認できません。
            </p>
          ) : null}
          {(view.metrics.unverifiedCount ?? 0) > 0 ? (
            <p className="warning-copy">
              未確認事項が{view.metrics.unverifiedCount}件あります。適用前に理由と安全上の制限を確認してください。
            </p>
          ) : null}
          <div className="button-row">
            <button
              ref={confirmButtonRef}
              type="button"
              className="primary-button"
              onClick={() => {
                const identity = snapshot.identity;
                setConfirmationIdentity(undefined);
                apply(identity);
              }}
            >
              配置案を適用
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setConfirmationIdentity(undefined);
                queueMicrotask(() => applyButtonRef.current?.focus());
              }}
            >
              適用をやめる
            </button>
          </div>
        </div>
      ) : null}

      {snapshot.phase === "ready" ? (
        <dl className="automatic-proposal__metrics">
          <div>
            <dt>現在の配置</dt>
            <dd>{view.metrics.currentPlacementCount}件</dd>
          </div>
          <div>
            <dt>配置案の件数</dt>
            <dd>{view.metrics.proposalPlacementCount}件</dd>
          </div>
          <div>
            <dt>要求attempt</dt>
            <dd>{view.metrics.requestAttemptCount}回</dd>
          </div>
          <div>
            <dt>探索試行</dt>
            <dd>{view.metrics.candidateCount}件</dd>
          </div>
          <div>
            <dt>アルゴリズム</dt>
            <dd><code>{view.metrics.algorithmVersion}</code></dd>
          </div>
          <div>
            <dt>固定上限</dt>
            <dd>
              コンテナ{view.metrics.effectiveLimits?.candidateAttemptLimit}回・要求
              {view.metrics.effectiveLimits?.requestAttemptLimit}回・候補点
              {view.metrics.effectiveLimits?.candidatePointLimit}点
            </dd>
          </div>
        </dl>
      ) : null}

      {view.selectedContainerLabel === undefined ? null : (
        <p className="automatic-proposal__selected">
          配置先コンテナ: {view.selectedContainerLabel}
        </p>
      )}

      {view.candidates.total === 0 ? null : (
        <section className="automatic-proposal__group" aria-labelledby="automatic-proposal-candidates">
          <h3 id="automatic-proposal-candidates">コンテナ別の探索結果</h3>
          <ol className="automatic-proposal__cards" start={view.candidates.offset + 1}>
            {view.candidates.rows.map((row) => (
              <li key={row.containerId}>
                <strong>{row.containerName} ({row.containerId})</strong>
                <span>{row.outcomeLabel}</span>
                <span>{row.attemptCount} attempt</span>
                {row.cutoffLabel === undefined ? null : <span>{row.cutoffLabel}</span>}
              </li>
            ))}
          </ol>
          <PageControls
            label="コンテナ"
            page={view.candidates}
            onOffsetChange={(offset) => updateOffset("candidateOffset", offset)}
          />
        </section>
      )}

      {view.placements.total === 0 ? null : (
        <section className="automatic-proposal__group" aria-labelledby="automatic-proposal-placements">
          <h3 id="automatic-proposal-placements">配置案（未適用）</h3>
          <ol className="automatic-proposal__cards" start={view.placements.offset + 1}>
            {view.placements.rows.map((row) => (
              <li key={row.cargoId}>
                <strong>{row.cargoName} ({row.cargoId})</strong>
                <span>向き {row.orientation}</span>
                <span>最小角 ({row.xMm}, {row.yMm}, {row.zMm}) mm</span>
              </li>
            ))}
          </ol>
          <PageControls
            label="配置案"
            page={view.placements}
            onOffsetChange={(offset) => updateOffset("placementOffset", offset)}
          />
        </section>
      )}

      {view.unverifiedReasons.total === 0 ? null : (
        <section className="automatic-proposal__group" aria-labelledby="automatic-proposal-unverified">
          <h3 id="automatic-proposal-unverified">
            未確認事項（{view.unverifiedReasons.total}件）
          </h3>
          <ol className="automatic-proposal__cards automatic-proposal__cards--warning" start={view.unverifiedReasons.offset + 1}>
            {view.unverifiedReasons.rows.map((reason) => (
              <li key={`${reason.code}:${reason.targetCargoId}`}>
                <strong>{reason.targetCargoName} ({reason.targetCargoId})</strong>
                <span>{reason.message}</span>
                {reason.relatedCargoTotal === 0 ? null : (
                  <span>
                    関連積荷: {reason.relatedCargoLabels.join("、")}
                    {reason.relatedCargoTotal > reason.relatedCargoLabels.length
                      ? `、ほか${reason.relatedCargoTotal - reason.relatedCargoLabels.length}件`
                      : ""}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <PageControls
            label="未確認事項"
            page={view.unverifiedReasons}
            onOffsetChange={(offset) => updateOffset("unverifiedOffset", offset)}
          />
        </section>
      )}

      <p className="automatic-proposal__safety">{view.safetyNotice}</p>
    </section>
  );
}
