type CapabilityState =
  | "checking"
  | "renderer-checking"
  | "supported"
  | "unsupported"
  | "renderer-error";

interface ApplicationBarProps {
  readonly capabilityState: CapabilityState;
  readonly controlsDisabled?: boolean;
  readonly navigationDisabled?: boolean;
  readonly drawerOpen?: boolean;
  readonly onOpenNavigation?: () => void;
  readonly onOpenProjectSettings?: () => void;
  readonly projectName?: string;
  readonly projectSettingsDisabled?: boolean;
}

const chipCopy: Record<CapabilityState, string> = {
  checking: "3D 確認中",
  "renderer-checking": "3D 描画確認中",
  supported: "3D 利用可",
  unsupported: "3D 利用不可",
  "renderer-error": "3D 利用不可",
};

export function ApplicationBar({
  capabilityState,
  controlsDisabled = false,
  navigationDisabled = controlsDisabled,
  drawerOpen = false,
  onOpenNavigation,
  onOpenProjectSettings,
  projectName,
  projectSettingsDisabled = controlsDisabled,
}: ApplicationBarProps) {
  const operational = capabilityState === "supported";
  return (
    <header className="application-bar">
      <div className="application-bar__primary">
        <button
          id="app-navigation-button"
          className="application-bar__icon-button"
          type="button"
          aria-label="ナビゲーションメニューを開く（CLPデータを開く）"
          aria-controls="project-persistence-drawer"
          aria-expanded={drawerOpen}
          disabled={!operational || navigationDisabled}
          onClick={onOpenNavigation}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" />
          </svg>
        </button>
        <h1>Auto CLP</h1>
      </div>
      <div className="application-bar__actions">
        {projectName === undefined ? null : (
          <button
            id="current-project-settings-button"
            className="application-bar__project"
            type="button"
            title={`${projectName}の設定を開く`}
            disabled={!operational || projectSettingsDisabled}
            onClick={onOpenProjectSettings}
          >
            {projectName}
          </button>
        )}
        <span
          className="capability-chip"
          data-capability-state={capabilityState}
          role="status"
          aria-label={chipCopy[capabilityState]}
        >
          <span aria-hidden="true" />
          {chipCopy[capabilityState]}
        </span>
      </div>
    </header>
  );
}
