import { useCallback, useEffect, useState } from "react";

import type { WebGL2CapabilityCheck } from "./platform/webgl2";
import { ThreeViewport } from "./scene/ThreeViewport";

type AppState =
  | "checking"
  | "renderer-checking"
  | "supported"
  | "unsupported"
  | "renderer-error";

interface AppProps {
  readonly capabilityCheck: WebGL2CapabilityCheck;
  readonly forceInitialRenderError?: boolean;
}

const stateCopy: Record<AppState, { readonly title: string; readonly detail: string }> = {
  checking: {
    title: "3D表示環境を確認中",
    detail: "このブラウザでWebGL 2を利用できるか確認しています。",
  },
  "renderer-checking": {
    title: "3D描画を確認中",
    detail: "WebGL 2の対応を確認しました。初回描画が完了するまで利用可能とは表示しません。",
  },
  supported: {
    title: "3D表示を利用できます",
    detail: "現在はアプリ基盤の確認用プレビューです。積荷入力と配置操作はまだ利用できません。",
  },
  unsupported: {
    title: "3D表示を利用できません",
    detail: "WebGL 2対応の現行デスクトップブラウザとGPU設定を確認してください。積載可否は判定していません。",
  },
  "renderer-error": {
    title: "3D表示で問題が発生しました",
    detail: "初期化または描画の障害を成功扱いせず停止しました。ブラウザのGPU設定を確認してから再読み込みしてください。",
  },
};

export function App({ capabilityCheck, forceInitialRenderError = false }: AppProps) {
  const [state, setState] = useState<AppState>("checking");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      const capability = capabilityCheck();
      setState(capability.status === "supported" ? "renderer-checking" : "unsupported");
    });

    return () => {
      cancelled = true;
    };
  }, [capabilityCheck]);

  const handleRendererReady = useCallback(() => {
    setState((current) => (current === "renderer-checking" ? "supported" : current));
  }, []);

  const handleRendererError = useCallback(() => {
    setState((current) => (current === "unsupported" ? current : "renderer-error"));
  }, []);

  const copy = stateCopy[state];
  const rendererMounted = state === "renderer-checking" || state === "supported";

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">LOCAL 3D LOADING WORKSPACE</p>
        <h1>Auto CLP</h1>
        <p className="lede">精密機器輸送の積載案を、端末内で安全側に検討するための試作環境です。</p>
      </header>

      <section
        className={`capability capability--${state}`}
        role="status"
        aria-live="polite"
        aria-labelledby="capability-title"
        data-capability-state={state}
      >
        <div className="capability__copy">
          <span className="status-dot" aria-hidden="true" />
          <div>
            <h2 id="capability-title">{copy.title}</h2>
            <p>{copy.detail}</p>
          </div>
        </div>
        {rendererMounted ? (
          <ThreeViewport
            forceInitialRenderError={forceInitialRenderError}
            onRendererError={handleRendererError}
            onRendererReady={handleRendererReady}
          />
        ) : null}
      </section>

      <aside className="safety-note" aria-label="現在の制限">
        <strong>現在の段階</strong>
        <span>物理的安全性、法令適合性、荷崩れ防止を保証するものではありません。</span>
      </aside>
    </main>
  );
}
