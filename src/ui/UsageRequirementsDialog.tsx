import { useState } from "react";

import { ModalShell } from "./ModalShell";

export const USAGE_REQUIREMENTS_VERSION = "1.2.0";
const STORAGE_KEY = "auto-clp.usage-requirements-version";

export function hasConfirmedCurrentUsageRequirements(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === USAGE_REQUIREMENTS_VERSION;
  } catch {
    return false;
  }
}

export function rememberCurrentUsageRequirements(): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, USAGE_REQUIREMENTS_VERSION);
    return window.localStorage.getItem(STORAGE_KEY) === USAGE_REQUIREMENTS_VERSION;
  } catch {
    return false;
  }
}

interface UsageRequirementsDialogProps {
  readonly required: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (persisted: boolean) => void;
}

export function UsageRequirementsDialog({
  required,
  onClose,
  onConfirm,
}: UsageRequirementsDialogProps) {
  const [storageNotice, setStorageNotice] = useState("");
  const [storageFailed, setStorageFailed] = useState(false);
  return (
    <ModalShell
      dismissible={!required}
      fallbackFocusIds={["app-navigation-button", "physical-validation-lamp"]}
      initialFocusId="usage-requirements-confirm"
      onRequestClose={onClose}
      title="使用上の重要事項"
    >
      <section className="usage-requirements" aria-describedby="usage-requirements-summary">
        <p id="usage-requirements-summary">
          Auto CLPの3D描画、実装済みの物理判定、積荷の合成重心表示は計画を支援する参考機能です。実際の積込み・運搬は、利用者が別途確認して責任を負ってください。
        </p>
        <ul>
          <li>合成重心は、入力された積荷重量と、各積荷の重心が向き適用後の直方体中央にあるという仮定だけから計算します。</li>
          <li>コンテナ自重、実貨物の偏心、支持反力、軸重、床荷重は計算しません。</li>
          <li>積載可能性、完全な搬入経路、構造強度・安定性、荷崩れ、固縛、輸送中の動荷重は評価・保証しません。</li>
          <li>法令適合性または実積載の安全性も評価・保証しません。</li>
        </ul>
        <p>
          青い判定表示は「実装済み確認項目内で問題なし」を意味し、積載可能または安全という判定ではありません。
        </p>
        <p>
          3D上の赤い点はコンテナ幾何中心、黄色い点は積荷だけの現在重心を示します。異常、警告、合否または積載可否を意味しません。
        </p>
        <p className="usage-requirements__data-warning">
          実在する顧客名、個人情報、秘密情報、実貨物や搬送記録を入力しないでください。
        </p>
        <p className="usage-requirements__version">
          内容版 {USAGE_REQUIREMENTS_VERSION}。これは法的な利用規約への同意ではありません。
        </p>
        <div className="button-row">
          <button
            id="usage-requirements-confirm"
            className="primary-button"
            type="button"
            onClick={() => {
              const persisted = rememberCurrentUsageRequirements();
              if (!persisted) {
                setStorageFailed(true);
                setStorageNotice(
                  "このブラウザへ確認状態を保存できませんでした。このセッションでは続行できますが、次回は再確認します。",
                );
                return;
              }
              onConfirm(persisted);
            }}
          >
            内容を確認して続ける
          </button>
          {storageFailed ? (
            <button type="button" onClick={() => onConfirm(false)}>
              このセッションだけ続ける
            </button>
          ) : null}
          {required ? null : (
            <button type="button" onClick={onClose}>閉じる</button>
          )}
        </div>
        {storageNotice === "" ? null : (
          <p role="status" className="usage-requirements__storage-notice">{storageNotice}</p>
        )}
      </section>
    </ModalShell>
  );
}
