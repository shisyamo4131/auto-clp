import { useEffect, useMemo, useState } from "react";

import type { Project } from "../domain/model";
import { projectContainerToScene } from "./project-scene";
import { ThreeViewport } from "./ThreeViewport";

interface SceneWorkspaceProps {
  readonly forceInitialRenderError?: boolean;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
  readonly project: Project;
  readonly rendererMounted: boolean;
}

function projectionErrorMessage(code: "scene.container-not-found" | "scene.cargo-not-found"): string {
  if (code === "scene.container-not-found") {
    return "選択した候補が案件内に見つからないため、3D表示を更新できません。";
  }
  return "配置が参照する積荷が案件内に見つからないため、3D表示を更新できません。";
}

export function SceneWorkspace({
  forceInitialRenderError = false,
  onRendererError,
  onRendererReady,
  project,
  rendererMounted,
}: SceneWorkspaceProps) {
  const [selectedContainerId, setSelectedContainerId] = useState<string>();
  const selectedContainer = project.containers.find(
    (container) => container.id === selectedContainerId,
  );
  const effectiveContainerId = selectedContainer?.id ?? project.containers[0]?.id;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setSelectedContainerId((current) => {
        if (project.containers.length === 0) {
          return undefined;
        }
        if (project.containers.some((container) => container.id === current)) {
          return current;
        }
        return project.containers[0]?.id;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [project.containers]);

  const projectionResult = useMemo(
    () =>
      effectiveContainerId === undefined
        ? undefined
        : projectContainerToScene(project, effectiveContainerId),
    [effectiveContainerId, project],
  );
  const projection = projectionResult?.ok === true ? projectionResult.projection : null;
  const placementCount =
    effectiveContainerId === undefined
      ? 0
      : project.placements.filter(
          (placement) => placement.containerId === effectiveContainerId,
        ).length;

  return (
    <section className="scene-workspace" aria-labelledby="scene-workspace-title">
      <div className="scene-workspace__controls">
        <div>
          <p className="eyebrow">PROJECT SCENE</p>
          <h3 id="scene-workspace-title">3D確認候補</h3>
        </div>

        {project.containers.length === 0 ? (
          <p className="scene-workspace__empty">
            表示する候補がありません。案件入力でコンテナ・車両候補を追加してください。
          </p>
        ) : (
          <div className="scene-workspace__field">
            <label htmlFor="scene-container-select">表示する候補</label>
            <select
              id="scene-container-select"
              value={effectiveContainerId}
              onChange={(event) => setSelectedContainerId(event.target.value)}
            >
              {project.containers.map((container) => (
                <option key={container.id} value={container.id}>
                  {container.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <p
          id="scene-workspace-status"
          className="scene-workspace__status"
          aria-live="polite"
          aria-atomic="true"
        >
          {effectiveContainerId === undefined
            ? "候補0件、配置0件。適合判定は未実施です。"
            : `選択中: ${project.containers.find((container) => container.id === effectiveContainerId)?.name ?? "不明な候補"}。配置${placementCount}件。適合判定は未実施です。`}
        </p>

        {projectionResult !== undefined && !projectionResult.ok ? (
          <p className="scene-workspace__error" role="alert">
            {projectionErrorMessage(projectionResult.error.code)}
          </p>
        ) : null}

        <p className="scene-workspace__notice">
          描画は配置の見た目を確認するためのもので、積載可能性や物理的安全性を保証しません。
        </p>
      </div>

      {rendererMounted ? (
        <ThreeViewport
          forceInitialRenderError={forceInitialRenderError}
          onRendererError={onRendererError}
          onRendererReady={onRendererReady}
          projection={projection}
          statusDescriptionId="scene-workspace-status"
        />
      ) : null}
    </section>
  );
}
