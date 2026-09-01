import type {
  AutomaticProposalCandidateAttemptSummary,
  AutomaticProposalCutoffSource,
  AutomaticProposalEffectiveLimits,
  AutomaticProposalResult,
  AutomaticProposalStatus,
  AutomaticProposalUnverifiedReason,
} from "../domain/automatic-proposal";
import type { Cargo, Orientation, Placement, Project } from "../domain/model";
import type { AutomaticProposalSessionSnapshot } from "./automatic-proposal-session";

export const AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE = 25 as const;
export const AUTOMATIC_PROPOSAL_RELATED_CARGO_VIEW_LIMIT = 25 as const;

export interface AutomaticProposalViewPageRequest {
  readonly candidateOffset?: number;
  readonly placementOffset?: number;
  readonly unverifiedOffset?: number;
}

export interface AutomaticProposalCandidateViewRow {
  readonly containerId: string;
  readonly containerName: string;
  readonly attemptCount: number;
  readonly outcome: "complete" | "exhausted" | "cutoff";
  readonly outcomeLabel: string;
  readonly cutoffLabel?: string;
}

export interface AutomaticProposalPlacementViewRow {
  readonly cargoId: string;
  readonly cargoName: string;
  readonly orientation: Orientation;
  readonly xMm: number;
  readonly yMm: number;
  readonly zMm: number;
}

export interface AutomaticProposalUnverifiedViewRow {
  readonly code: "support-conditions-unverified";
  readonly message: string;
  readonly targetCargoId: string;
  readonly targetCargoName: string;
  readonly relatedCargoLabels: readonly string[];
  readonly relatedCargoTotal: number;
}

export interface AutomaticProposalViewPage<Row> {
  readonly offset: number;
  readonly total: number;
  readonly rows: readonly Row[];
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

export interface AutomaticProposalViewMetrics {
  readonly currentPlacementCount: number;
  readonly proposalPlacementCount: number;
  readonly requestAttemptCount?: number;
  readonly candidateCount?: number;
  readonly unverifiedCount?: number;
  readonly algorithmVersion?: string;
  readonly effectiveLimits?: AutomaticProposalEffectiveLimits;
}

export interface AutomaticProposalView {
  readonly phase:
    | "idle"
    | "running"
    | "ready"
    | "applying"
    | "applied"
    | "unchanged"
    | "apply-failed"
    | "blocked"
    | "failed"
    | "cancelled"
    | "stale";
  readonly status?: AutomaticProposalStatus;
  readonly tone: "neutral" | "progress" | "success" | "warning" | "error";
  readonly badge: string;
  readonly heading: string;
  readonly summary: string;
  readonly detail: string;
  readonly safetyNotice: string;
  readonly canStart: boolean;
  readonly canCancel: boolean;
  readonly canRetry: boolean;
  readonly isApplicablePreview: boolean;
  readonly selectedContainerLabel?: string;
  readonly metrics: AutomaticProposalViewMetrics;
  readonly candidates: AutomaticProposalViewPage<AutomaticProposalCandidateViewRow>;
  readonly placements: AutomaticProposalViewPage<AutomaticProposalPlacementViewRow>;
  readonly unverifiedReasons: AutomaticProposalViewPage<AutomaticProposalUnverifiedViewRow>;
}

interface ReadyCopy {
  readonly tone: AutomaticProposalView["tone"];
  readonly badge: string;
  readonly summary: string;
  readonly detail: string;
}

const SAFETY_NOTICE =
  "配置案は検討用です。完全な搬入経路、構造・安定性、実積載の安全性を保証しません。";

const READY_COPY = {
  "no-cargo": {
    tone: "neutral",
    badge: "対象なし",
    summary: "配置案を作成する積荷がありません。CLPは変更していません。",
    detail: "積荷を登録してから探索してください。",
  },
  "no-candidates": {
    tone: "neutral",
    badge: "コンテナなし",
    summary: "配置案の作成先となるコンテナがありません。CLPは変更していません。",
    detail: "コンテナを登録してから探索してください。",
  },
  "no-complete-plan": {
    tone: "warning",
    badge: "完全案なし",
    summary:
      "登録済みコンテナと今回の探索モデルでは、全積荷を配置できる案がありませんでした。",
    detail: "これは実積載不能の証明ではありません。CLPは変更していません。",
  },
  cutoff: {
    tone: "warning",
    badge: "探索打切り",
    summary: "探索上限に達したため、完全案を確定できませんでした。",
    detail:
      "配置できる案が存在しないという意味ではありません。CLPは変更していません。",
  },
  complete: {
    tone: "success",
    badge: "配置案あり・未適用",
    summary: "現行の計算規則を満たす配置案が見つかりました。まだCLPへ適用していません。",
    detail: "未確認事項と配置内容を確認してから適用を判断してください。",
  },
  "complete-with-cutoff": {
    tone: "warning",
    badge: "案あり・最良未確認・未適用",
    summary:
      "完全案は見つかりましたが、より優先されるコンテナの探索が上限に達したため、目的関数上の最良とは確認できません。",
    detail:
      "配置案はまだCLPへ適用していません。未確認事項と安全上の制限を確認してください。",
  },
} satisfies Record<AutomaticProposalStatus, ReadyCopy>;

const CANDIDATE_OUTCOME_LABELS = {
  complete: "完全案あり",
  exhausted: "探索済み・完全案なし",
  cutoff: "探索上限到達",
} as const;

const CUTOFF_LABELS = {
  candidate: "コンテナごとの上限",
  request: "依頼全体の上限",
  both: "コンテナと依頼全体の上限",
} satisfies Record<AutomaticProposalCutoffSource, string>;

function normalizedOffset(value: number | undefined, total: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, total)
    : 0;
}

function page<Row>(
  rows: readonly Row[],
  requestedOffset: number | undefined,
): AutomaticProposalViewPage<Row> {
  const offset = normalizedOffset(requestedOffset, rows.length);
  const pageRows = rows.slice(offset, offset + AUTOMATIC_PROPOSAL_VIEW_PAGE_SIZE);
  return {
    offset,
    total: rows.length,
    rows: pageRows,
    hasPrevious: offset > 0,
    hasNext: offset + pageRows.length < rows.length,
  };
}

function emptyPage<Row>(): AutomaticProposalViewPage<Row> {
  return { offset: 0, total: 0, rows: [], hasPrevious: false, hasNext: false };
}

function baseView(
  project: Project,
  values: Pick<
    AutomaticProposalView,
    | "phase"
    | "tone"
    | "badge"
    | "summary"
    | "detail"
    | "canStart"
    | "canCancel"
    | "canRetry"
  >,
): AutomaticProposalView {
  return {
    ...values,
    heading: "自動配置提案",
    safetyNotice: SAFETY_NOTICE,
    isApplicablePreview: false,
    metrics: {
      currentPlacementCount: project.placements.length,
      proposalPlacementCount: 0,
    },
    candidates: emptyPage(),
    placements: emptyPage(),
    unverifiedReasons: emptyPage(),
  };
}

function genericFailure(project: Project): AutomaticProposalView {
  return baseView(project, {
    phase: "failed",
    tone: "error",
    badge: "計算不能",
    summary: "自動提案を計算できませんでした。CLPは変更していません。",
    detail: "入力状態を確認して、もう一度実行してください。",
    canStart: false,
    canCancel: false,
    canRetry: true,
  });
}

function applyFailure(project: Project): AutomaticProposalView {
  return baseView(project, {
    phase: "apply-failed",
    tone: "error",
    badge: "適用せず",
    summary:
      "配置案を再検証できなかったため適用しませんでした。CLPは変更していません。",
    detail: "現在のCLPで探索し直してください。",
    canStart: false,
    canCancel: false,
    canRetry: true,
  });
}

function completedApplyView(
  snapshot: Extract<
    AutomaticProposalSessionSnapshot,
    { readonly phase: "applied" | "unchanged" }
  >,
  project: Project,
): AutomaticProposalView {
  if (snapshot.currentProject !== project) {
    return baseView(project, {
      phase: "idle",
      tone: "neutral",
      badge: "未実行",
      summary: "配置案はまだ作成していません。",
      detail: "現在のCLPを変更せず、別処理で完全案を探索します。",
      canStart: true,
      canCancel: false,
      canRetry: false,
    });
  }
  const container = project.containers.find(
    ({ id }) => id === snapshot.summary.containerId,
  );
  if (container === undefined) {
    return applyFailure(project);
  }
  const applied = snapshot.phase === "applied";
  return {
    ...baseView(project, {
      phase: snapshot.phase,
      tone: applied ? "success" : "neutral",
      badge: applied ? "適用済み" : "変更なし",
      summary: applied
        ? `コンテナ${container.name} (${container.id})へ${snapshot.summary.placementCount}件適用、1回の取り消しで元へ戻せます。`
        : "配置案は現在の配置と同じため、CLPと操作履歴は変更していません。",
      detail:
        snapshot.summary.unverifiedReasonCount > 0
          ? `未確認事項${snapshot.summary.unverifiedReasonCount}件を保持しています。安全上の制限を再確認してください。`
          : "配置案の適用後も、安全上の制限を確認してください。",
      canStart: false,
      canCancel: false,
      canRetry: false,
    }),
    selectedContainerLabel: `${container.name} (${container.id})`,
    metrics: {
      currentPlacementCount: project.placements.length,
      proposalPlacementCount: snapshot.summary.placementCount,
      unverifiedCount: snapshot.summary.unverifiedReasonCount,
    },
  };
}

function resultMatchesProject(
  result: AutomaticProposalResult,
  project: Project,
): boolean {
  const cargoById = new Map(project.cargoes.map((cargo) => [cargo.id, cargo]));
  const containerIds = new Set(project.containers.map(({ id }) => id));
  if (
    result.attempts.candidates.some(
      ({ containerId }) => !containerIds.has(containerId),
    )
  ) {
    return false;
  }

  if (result.status === "no-cargo") {
    return (
      project.cargoes.length === 0 &&
      result.attempts.requestAttemptCount === 0 &&
      result.attempts.candidates.length === 0
    );
  }
  if (result.status === "no-candidates") {
    return (
      project.cargoes.length > 0 &&
      project.containers.length === 0 &&
      result.attempts.requestAttemptCount === 0 &&
      result.attempts.candidates.length === 0
    );
  }
  if (project.cargoes.length === 0 || project.containers.length === 0) {
    return false;
  }
  if (result.status === "no-complete-plan") {
    return result.attempts.candidates.length === project.containers.length;
  }
  if (result.status === "cutoff") {
    return true;
  }
  if (result.status !== "complete" && result.status !== "complete-with-cutoff") {
    return false;
  }

  const plan = result.plan;
  if (
    !containerIds.has(plan.containerId) ||
    plan.placements.length !== project.cargoes.length ||
    plan.placements.some(({ containerId }) => containerId !== plan.containerId)
  ) {
    return false;
  }
  const placementCargoIds = new Set(plan.placements.map(({ cargoId }) => cargoId));
  if (
    placementCargoIds.size !== project.cargoes.length ||
    project.cargoes.some(({ id }) => !placementCargoIds.has(id))
  ) {
    return false;
  }
  for (const placement of plan.placements) {
    const cargo = cargoById.get(placement.cargoId);
    if (cargo === undefined || !cargo.allowedOrientations.includes(placement.orientation)) {
      return false;
    }
  }
  return plan.unverifiedReasons.every(
    (reason) =>
      reason.target.kind === "cargo" &&
      cargoById.has(reason.target.id) &&
      reason.relatedCargoIds.every((id) => cargoById.has(id)),
  );
}

function candidateRows(
  candidates: readonly AutomaticProposalCandidateAttemptSummary[],
  project: Project,
): readonly AutomaticProposalCandidateViewRow[] {
  const containerById = new Map(
    project.containers.map((container) => [container.id, container]),
  );
  return candidates.map((candidate) => {
    const container = containerById.get(candidate.containerId) as NonNullable<
      ReturnType<typeof containerById.get>
    >;
    return {
      containerId: container.id,
      containerName: container.name,
      attemptCount: candidate.attemptCount,
      outcome: candidate.outcome,
      outcomeLabel: CANDIDATE_OUTCOME_LABELS[candidate.outcome],
      ...(candidate.outcome === "cutoff"
        ? {
            cutoffLabel:
              candidate.cutoffSource === undefined
                ? "探索上限"
                : CUTOFF_LABELS[candidate.cutoffSource],
          }
        : {}),
    };
  });
}

function placementRows(
  placements: readonly Placement[],
  project: Project,
): readonly AutomaticProposalPlacementViewRow[] {
  const cargoById = new Map(project.cargoes.map((cargo) => [cargo.id, cargo]));
  return placements.map((placement) => {
    const cargo = cargoById.get(placement.cargoId) as Cargo;
    return {
      cargoId: cargo.id,
      cargoName: cargo.name,
      orientation: placement.orientation,
      xMm: placement.positionMm.xMm,
      yMm: placement.positionMm.yMm,
      zMm: placement.positionMm.zMm,
    };
  });
}

function unverifiedRows(
  reasons: readonly AutomaticProposalUnverifiedReason[],
  project: Project,
): readonly AutomaticProposalUnverifiedViewRow[] {
  const cargoById = new Map(project.cargoes.map((cargo) => [cargo.id, cargo]));
  return reasons.map((reason) => {
    const target = cargoById.get(reason.target.id) as Cargo;
    return {
      code: reason.code,
      message: "複数支持、隙間、張り出し等の支持条件は未確認です。",
      targetCargoId: target.id,
      targetCargoName: target.name,
      relatedCargoLabels: reason.relatedCargoIds
        .slice(0, AUTOMATIC_PROPOSAL_RELATED_CARGO_VIEW_LIMIT)
        .map((id) => {
          const related = cargoById.get(id) as Cargo;
          return `${related.name} (${related.id})`;
        }),
      relatedCargoTotal: reason.relatedCargoIds.length,
    };
  });
}

export function automaticProposalView(
  snapshot: AutomaticProposalSessionSnapshot,
  sourceProject: Project,
  pages: AutomaticProposalViewPageRequest = {},
): AutomaticProposalView {
  if (snapshot.phase === "idle") {
    return baseView(sourceProject, {
      phase: "idle",
      tone: "neutral",
      badge: "未実行",
      summary: "配置案はまだ作成していません。",
      detail: "現在のCLPを変更せず、別処理で完全案を探索します。",
      canStart: true,
      canCancel: false,
      canRetry: false,
    });
  }
  if (snapshot.phase === "running") {
    if (snapshot.sourceProject !== sourceProject) {
      return baseView(sourceProject, {
        phase: "stale",
        tone: "warning",
        badge: "結果破棄",
        summary: "CLPが変わったため探索結果を使用しません。",
        detail: "現在のCLPで探索を開始し直してください。",
        canStart: true,
        canCancel: false,
        canRetry: true,
      });
    }
    return baseView(sourceProject, {
      phase: "running",
      tone: "progress",
      badge: "探索中",
      summary: "現在のCLPから完全案を探索しています。CLPは変更していません。",
      detail: "探索はいつでも中止できます。",
      canStart: false,
      canCancel: true,
      canRetry: false,
    });
  }
  if (snapshot.phase === "applying") {
    return baseView(sourceProject, {
      phase: "applying",
      tone: "progress",
      badge: "適用中",
      summary: "配置案を現在のCLPへ一括適用しています。",
      detail: "適用結果を確認しています。",
      canStart: false,
      canCancel: false,
      canRetry: false,
    });
  }
  if (snapshot.phase === "applied" || snapshot.phase === "unchanged") {
    return completedApplyView(snapshot, sourceProject);
  }
  if (snapshot.phase === "failed") {
    return genericFailure(sourceProject);
  }
  if (snapshot.phase === "apply-failed") {
    return applyFailure(sourceProject);
  }
  if (snapshot.phase === "blocked") {
    return baseView(sourceProject, {
      phase: "blocked",
      tone: "warning",
      badge: "適用保留",
      summary: "入力または別の操作中だったため、配置案を適用しませんでした。",
      detail: "現在のCLPで自動提案を実行し直してください。",
      canStart: true,
      canCancel: false,
      canRetry: true,
    });
  }
  if (snapshot.phase === "cancelled") {
    return baseView(sourceProject, {
      phase: "cancelled",
      tone: "neutral",
      badge: "取消済み",
      summary: "探索を中止しました。CLPは変更していません。",
      detail: "必要なら現在のCLPでもう一度実行できます。",
      canStart: true,
      canCancel: false,
      canRetry: true,
    });
  }
  if (snapshot.phase === "stale") {
    return baseView(sourceProject, {
      phase: "stale",
      tone: "warning",
      badge: "結果破棄",
      summary: "CLPまたは入力状態が変わったため、探索結果を破棄しました。",
      detail: "現在のCLPで探索を開始し直してください。",
      canStart: true,
      canCancel: false,
      canRetry: true,
    });
  }

  if (
    snapshot.sourceProject !== sourceProject ||
    !resultMatchesProject(snapshot.result, sourceProject)
  ) {
    return genericFailure(sourceProject);
  }

  const result = snapshot.result;
  const copy = READY_COPY[result.status];
  const proposal =
    result.status === "complete" || result.status === "complete-with-cutoff"
      ? result.plan
      : undefined;
  const candidates = candidateRows(result.attempts.candidates, sourceProject);
  const placements =
    proposal === undefined ? [] : placementRows(proposal.placements, sourceProject);
  const reasons =
    proposal === undefined
      ? []
      : unverifiedRows(proposal.unverifiedReasons, sourceProject);
  const selectedContainer =
    proposal === undefined
      ? undefined
      : sourceProject.containers.find(({ id }) => id === proposal.containerId);
  const countDetail =
    proposal === undefined
      ? copy.detail
      : `現在の配置${sourceProject.placements.length}件に対し、配置案${proposal.placements.length}件です。${copy.detail}`;

  return {
    phase: "ready",
    status: result.status,
    tone: copy.tone,
    badge: copy.badge,
    heading: "自動配置提案",
    summary: copy.summary,
    detail: countDetail,
    safetyNotice: SAFETY_NOTICE,
    canStart: true,
    canCancel: false,
    canRetry: false,
    isApplicablePreview: proposal !== undefined,
    ...(selectedContainer === undefined
      ? {}
      : {
          selectedContainerLabel: `${selectedContainer.name} (${selectedContainer.id})`,
        }),
    metrics: {
      currentPlacementCount: sourceProject.placements.length,
      proposalPlacementCount: proposal?.placements.length ?? 0,
      requestAttemptCount: result.attempts.requestAttemptCount,
      candidateCount: result.attempts.candidates.length,
      unverifiedCount: proposal?.unverifiedReasons.length ?? 0,
      algorithmVersion: result.algorithmVersion,
      effectiveLimits: { ...result.effectiveLimits },
    },
    candidates: page(candidates, pages.candidateOffset),
    placements: page(placements, pages.placementOffset),
    unverifiedReasons: page(reasons, pages.unverifiedOffset),
  };
}
