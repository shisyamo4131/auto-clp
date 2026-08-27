import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { checkWebGL2Capability } from "./platform/webgl2";
import type { WebGL2CapabilityCheck } from "./platform/webgl2";
import "./styles.css";

function capabilityCheckFor(search: string): WebGL2CapabilityCheck {
  const override = new URLSearchParams(search).get("forceWebgl2");
  if (override === "unsupported") {
    return () => ({ status: "unsupported", reason: "context-unavailable" });
  }
  return checkWebGL2Capability;
}

function shouldForceInitialRenderError(search: string): boolean {
  return new URLSearchParams(search).get("forceRenderer") === "initial-render-error";
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Auto CLP root element is missing");
}

createRoot(rootElement).render(
  <StrictMode>
    <App
      capabilityCheck={capabilityCheckFor(window.location.search)}
      forceInitialRenderError={shouldForceInitialRenderError(window.location.search)}
    />
  </StrictMode>,
);
