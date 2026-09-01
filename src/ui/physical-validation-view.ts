import type { Project } from "../domain/model";
import type {
  InvalidPhysicalReasonCode,
  PhysicalTarget,
  PhysicalValidationReason,
  PlacementSetUnavailableReason,
  PlacementSetValidationResult,
  UnverifiedPhysicalReasonCode,
} from "../domain/validation";
import type { PhysicalValidationEvaluationSummary } from "../workers/physical-validation-worker-protocol";

export type PhysicalValidationViewStatus =
  | "none"
  | "valid"
  | "invalid"
  | "unverified"
  | "unavailable";

export interface PhysicalValidationReasonView {
  readonly key: string;
  readonly status: "invalid" | "unverified";
  readonly statusLabel: "不適合" | "未確認";
  readonly message: string;
  readonly targetLabel: string;
  readonly relatedCargoLabels: readonly string[];
}

export interface PhysicalValidationView {
  readonly status: PhysicalValidationViewStatus;
  readonly statusLabel: string;
  readonly summary: string;
  readonly unavailableTargetLabel?: string;
  readonly invalidReasons: readonly PhysicalValidationReasonView[];
  readonly unverifiedReasons: readonly PhysicalValidationReasonView[];
}

export interface PhysicalValidationLabelMaps {
  readonly cargoNames: ReadonlyMap<string, string>;
  readonly containerNames: ReadonlyMap<string, string>;
}

const INVALID_REASON_COPY = {
  "floor-penetration":
    "積荷が床より下へ貫通しています。Z座標を0以上に修正してください。",
  "outside-container":
    "積荷がコンテナの壁または天井の境界を越えています。座標を先に修正してください。",
  "container-clearance-not-met":
    "積荷とコンテナ面の間に必要な軸別隙間がありません。座標を調整してください。",
  "positive-volume-overlap":
    "積荷同士が立体的に重なっています。配置を離してください。",
  "axis-clearance-not-met":
    "積荷同士の軸別隙間が不足しています。配置を調整してください。",
  "opening-no-fitting-orientation":
    "許可されたどの向きでも矩形開口の幅と高さに収まりません。",
  "support-contact-invalid":
    "床より上の積荷が、支持可能な上面と同じ高さで正面積接触していません。Z座標と支持可否を確認してください。",
  "payload-capacity-exceeded":
    "配置した積荷の合計重量がコンテナの耐荷重を超えています。",
} satisfies Record<InvalidPhysicalReasonCode, string>;

const UNVERIFIED_REASON_COPY = {
  "support-conditions-unverified":
    "複数支持、支持台間の隙間、張り出し、または支持不可面との混在を含みます。構造剛性、支持位置、重心、許容支持間隔を確認してください。",
} satisfies Record<UnverifiedPhysicalReasonCode, string>;

const UNAVAILABLE_REASON_COPY = {
  "physical.semantic-input-invalid":
    "CLPデータの参照または意味整合性に問題があるため、物理判定を実行できません。",
  "physical.container-not-found":
    "選択したコンテナがCLP内に見つからないため、物理判定を実行できません。",
  "physical.payload-calculation-unavailable":
    "重量または耐荷重を安全に計算できないため、物理判定を実行できません。",
  "physical.geometry-calculation-unavailable":
    "寸法・座標・隙間を安全に計算できないため、物理判定を実行できません。",
} satisfies Record<PlacementSetUnavailableReason["code"], string>;

function visibleId(id: string): string {
  return id === "" ? "（空文字）" : id;
}

export function createPhysicalValidationLabelMaps(
  project: Project,
): PhysicalValidationLabelMaps {
  return {
    cargoNames: new Map(project.cargoes.map((cargo) => [cargo.id, cargo.name])),
    containerNames: new Map(
      project.containers.map((container) => [container.id, container.name]),
    ),
  };
}

function targetLabel(labels: PhysicalValidationLabelMaps, target: PhysicalTarget): string {
  if (target.kind === "container") {
    return `${labels.containerNames.get(target.id) ?? "不明なコンテナ"}（ID: ${visibleId(target.id)}）`;
  }

  return `${labels.cargoNames.get(target.id) ?? "不明な積荷"}（ID: ${visibleId(target.id)}）`;
}

function relatedCargoLabel(
  labels: PhysicalValidationLabelMaps,
  cargoId: string,
): string {
  return `${labels.cargoNames.get(cargoId) ?? "不明な積荷"}（ID: ${visibleId(cargoId)}）`;
}

export function physicalValidationReasonKey(reason: PhysicalValidationReason): string {
  return JSON.stringify([
    reason.status,
    reason.code,
    reason.target.kind,
    reason.target.id,
    reason.relatedCargoIds,
  ]);
}

function reasonView(
  labels: PhysicalValidationLabelMaps,
  reason: PhysicalValidationReason,
): PhysicalValidationReasonView {
  const shared = {
    key: physicalValidationReasonKey(reason),
    targetLabel: targetLabel(labels, reason.target),
    relatedCargoLabels: reason.relatedCargoIds.map((cargoId) =>
      relatedCargoLabel(labels, cargoId),
    ),
  };

  if (reason.status === "invalid") {
    return {
      ...shared,
      status: reason.status,
      statusLabel: "不適合",
      message: INVALID_REASON_COPY[reason.code],
    };
  }

  return {
    ...shared,
    status: reason.status,
    statusLabel: "未確認",
    message: UNVERIFIED_REASON_COPY[reason.code],
  };
}

function unavailableTarget(
  labels: PhysicalValidationLabelMaps,
  reason: PlacementSetUnavailableReason,
): string | undefined {
  return "target" in reason ? targetLabel(labels, reason.target) : undefined;
}

export function toPhysicalValidationReasonViews(
  labels: PhysicalValidationLabelMaps,
  reasons: readonly PhysicalValidationReason[],
): readonly PhysicalValidationReasonView[] {
  return reasons.map((reason) => reasonView(labels, reason));
}

export function toPhysicalValidationSummaryView(
  labels: PhysicalValidationLabelMaps,
  summary: PhysicalValidationEvaluationSummary,
): Omit<PhysicalValidationView, "invalidReasons" | "unverifiedReasons"> {
  if (summary.kind === "unavailable") {
    return {
      status: "unavailable",
      statusLabel: "判定不能",
      summary: `判定不能：${UNAVAILABLE_REASON_COPY[summary.code]}`,
      unavailableTargetLabel:
        summary.target === undefined ? undefined : targetLabel(labels, summary.target),
    };
  }

  if (summary.status === "valid") {
    return {
      status: summary.status,
      statusLabel: "問題なし",
      summary:
        summary.placementCount === 0
          ? "実装済み確認項目内で問題なし：このコンテナには配置済みの積荷がありません。"
          : "実装済み確認項目内で問題なし：現在の保存済み配置に不適合・未確認はありません。",
    };
  }

  if (summary.status === "invalid") {
    return {
      status: summary.status,
      statusLabel: "不適合",
      summary: `不適合：修正が必要な理由が${summary.invalidCount}件あります。未確認事項${summary.unverifiedCount}件も保持して表示します。`,
    };
  }

  return {
    status: summary.status,
    statusLabel: "未確認",
    summary: `未確認：実装済み制約の不適合はありませんが、確認が必要な理由が${summary.unverifiedCount}件あります。`,
  };
}

export function toPhysicalValidationView(
  project: Project,
  result?: PlacementSetValidationResult,
): PhysicalValidationView {
  const labels = createPhysicalValidationLabelMaps(project);
  if (result === undefined) {
    return {
      status: "none",
      statusLabel: "判定対象なし",
      summary: "判定対象なし：コンテナを追加してください。",
      invalidReasons: [],
      unverifiedReasons: [],
    };
  }

  if (result.kind === "unavailable") {
    return {
      status: "unavailable",
      statusLabel: "判定不能",
      summary: `判定不能：${UNAVAILABLE_REASON_COPY[result.reason.code]}`,
      unavailableTargetLabel: unavailableTarget(labels, result.reason),
      invalidReasons: [],
      unverifiedReasons: [],
    };
  }

  const reasonViews = toPhysicalValidationReasonViews(labels, result.reasons);
  const invalidReasons = reasonViews.filter((reason) => reason.status === "invalid");
  const unverifiedReasons = reasonViews.filter(
    (reason) => reason.status === "unverified",
  );
  const placementCount = project.placements.filter(
    (placement) => placement.containerId === result.containerId,
  ).length;

  if (result.status === "valid") {
    return {
      status: result.status,
      statusLabel: "問題なし",
      summary:
        placementCount === 0
          ? "実装済み確認項目内で問題なし：このコンテナには配置済みの積荷がありません。"
          : "実装済み確認項目内で問題なし：現在の保存済み配置に不適合・未確認はありません。",
      invalidReasons,
      unverifiedReasons,
    };
  }

  if (result.status === "invalid") {
    return {
      status: result.status,
      statusLabel: "不適合",
      summary: `不適合：修正が必要な理由が${invalidReasons.length}件あります。未確認事項${unverifiedReasons.length}件も保持して表示します。`,
      invalidReasons,
      unverifiedReasons,
    };
  }

  return {
    status: result.status,
    statusLabel: "未確認",
    summary: `未確認：実装済み制約の不適合はありませんが、確認が必要な理由が${unverifiedReasons.length}件あります。`,
    invalidReasons,
    unverifiedReasons,
  };
}
