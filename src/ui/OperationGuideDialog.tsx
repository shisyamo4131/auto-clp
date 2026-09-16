import { ModalShell } from "./ModalShell";

interface OperationGuideDialogProps {
  readonly onClose: () => void;
}

export function OperationGuideDialog({ onClose }: OperationGuideDialogProps) {
  return (
    <ModalShell
      fallbackFocusIds={["app-navigation-button"]}
      onRequestClose={onClose}
      title="操作方法"
    >
      <section className="operation-guide" aria-label="3Dビューワーの操作方法">
        <p>
          3D上の積荷をクリックするか、画面下部の積荷選択から操作対象を選びます。
        </p>
        <dl>
          <div>
            <dt>視点を回転</dt>
            <dd>積荷以外の3D領域を左ドラッグします。</dd>
          </div>
          <div>
            <dt>視点を平行移動</dt>
            <dd>Ctrlを押しながら左ドラッグ、Shift＋左ドラッグ、または右ドラッグします。Ctrl中は積荷の上からでも視点移動を優先します。</dd>
          </div>
          <div>
            <dt>拡大・縮小と全体表示</dt>
            <dd>
              3D上でホイールを回して拡大・縮小し、立方体のボタンで荷室全体を表示します。
            </dd>
          </div>
          <div>
            <dt>荷室外の積荷を寄せる</dt>
            <dd>磁石ボタンで、荷室外の積荷を選択中コンテナの近くへ再整列し、全体が見える視点にします。この整理はUndoと保存の対象外です。</dd>
          </div>
          <div>
            <dt>積荷を移動・回転</dt>
            <dd>
              マウスなどの細かなポインターでは、積荷を左ドラッグして移動できます。X／Zボタンは90°回転し、天地無用の積荷はX軸回転できません。
            </dd>
          </div>
          <div>
            <dt>取り消し・やり直し</dt>
            <dd>
              Undo／Redoボタンを使います。Windows・LinuxではCtrl＋Z／Ctrl＋Shift＋Z／Ctrl＋Y、macOSではCommand＋Z／Command＋Shift＋Zも使えます。
            </dd>
          </div>
          <div>
            <dt>判定と正確な編集</dt>
            <dd>
              ランプから物理判定の詳細を開けます。積荷選択の下にある固定ボタンから、座標調整、積荷情報の編集、荷室からの取り外しなどを行えます。
            </dd>
          </div>
        </dl>
        <p>
          タッチ操作では積荷選択とページスクロールを行えます。正確な配置や編集には、画面下部のボタンとダイアログを使用してください。
        </p>
      </section>
    </ModalShell>
  );
}
