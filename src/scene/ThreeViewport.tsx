import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeViewportProps {
  readonly forceInitialRenderError?: boolean;
  readonly onRendererError: () => void;
  readonly onRendererReady: () => void;
}

export function ThreeViewport({
  forceInitialRenderError = false,
  onRendererError,
  onRendererReady,
}: ThreeViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container === null || canvas === null) {
      return;
    }

    let renderer: THREE.WebGLRenderer | undefined;
    let geometry: THREE.BoxGeometry | undefined;
    let material: THREE.MeshStandardMaterial | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let disposed = false;
    let readyReported = false;

    const dispose = () => {
      if (disposed) {
        return;
      }
      disposed = true;
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      resizeObserver?.disconnect();
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
    };

    const reportRendererError = () => {
      if (disposed) {
        return;
      }
      dispose();
      onRendererError();
    };

    function handleContextLost(event: Event) {
      event.preventDefault();
      reportRendererError();
    }

    canvas.addEventListener("webglcontextlost", handleContextLost);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x07111f, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(4, 3, 5);
      camera.lookAt(0, 0, 0);

      geometry = new THREE.BoxGeometry(2.4, 1.4, 1.6);
      material = new THREE.MeshStandardMaterial({ color: 0x40d4c4, roughness: 0.55 });
      const cargo = new THREE.Mesh(geometry, material);
      scene.add(cargo);
      scene.add(new THREE.HemisphereLight(0xc8f8ff, 0x1d2b44, 2.2));

      const render = () => {
        if (disposed || renderer === undefined) {
          return;
        }
        try {
          const width = Math.max(container.clientWidth, 1);
          const height = Math.max(container.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          if (forceInitialRenderError && !readyReported) {
            throw new Error("Forced initial renderer failure");
          }
          renderer.render(scene, camera);
          if (!readyReported) {
            readyReported = true;
            onRendererReady();
          }
        } catch {
          reportRendererError();
        }
      };

      resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(container);
      render();
    } catch {
      reportRendererError();
    }

    return dispose;
  }, [forceInitialRenderError, onRendererError, onRendererReady]);

  return (
    <div className="viewport" ref={containerRef}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="操作・判定結果ではない確認用直方体の3Dプレビュー"
      />
    </div>
  );
}
