export type WebGL2Capability =
  | { readonly status: "supported" }
  | { readonly status: "unsupported"; readonly reason: "context-unavailable" | "check-failed" };

export interface WebGL2Canvas {
  getContext(contextId: "webgl2"): unknown;
}

export type WebGL2CanvasFactory = () => WebGL2Canvas;
export type WebGL2CapabilityCheck = () => WebGL2Capability;

const createBrowserCanvas: WebGL2CanvasFactory = () => document.createElement("canvas");

export function checkWebGL2Capability(
  createCanvas: WebGL2CanvasFactory = createBrowserCanvas,
): WebGL2Capability {
  try {
    const context = createCanvas().getContext("webgl2");
    return context === null
      ? { status: "unsupported", reason: "context-unavailable" }
      : { status: "supported" };
  } catch {
    return { status: "unsupported", reason: "check-failed" };
  }
}
