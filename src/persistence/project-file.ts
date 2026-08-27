import type { ProjectJsonSource } from "./project-json";

export const PROJECT_EXPORT_FILENAME = "auto-clp-project-0.1.0.json";

export type ProjectFileFailureCode =
  | "project-file.import-unavailable"
  | "project-file.export-unavailable"
  | "project-file.download-failed";

export type ProjectFileResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: ProjectFileFailureCode };

export function isProjectFileImportAvailable(): boolean {
  try {
    return typeof File !== "undefined" && typeof File.prototype.text === "function";
  } catch {
    return false;
  }
}

export function isProjectFileExportAvailable(): boolean {
  try {
    return (
      typeof Blob !== "undefined" &&
      typeof URL !== "undefined" &&
      typeof URL.createObjectURL === "function" &&
      typeof URL.revokeObjectURL === "function" &&
      typeof document !== "undefined"
    );
  } catch {
    return false;
  }
}

export function projectJsonSourceFromFile(
  file: File,
): ProjectJsonSource | undefined {
  if (!isProjectFileImportAvailable()) {
    return undefined;
  }
  try {
    if (typeof file.text !== "function") {
      return undefined;
    }
    return {
      sizeBytes: file.size,
      readText: () => file.text(),
    };
  } catch {
    return undefined;
  }
}

export function downloadProjectJson(json: string): ProjectFileResult {
  if (!isProjectFileExportAvailable()) {
    return { ok: false, code: "project-file.export-unavailable" };
  }

  let objectUrl: string | undefined;
  let anchor: HTMLAnchorElement | undefined;
  const revokeObjectUrl = () => {
    if (objectUrl === undefined) {
      return;
    }
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Revocation is best-effort after the download has been requested.
    }
  };
  try {
    objectUrl = URL.createObjectURL(
      new Blob([json], { type: "application/json;charset=utf-8" }),
    );
    anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = PROJECT_EXPORT_FILENAME;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    revokeObjectUrl();
    return { ok: true };
  } catch {
    anchor?.remove();
    revokeObjectUrl();
    return { ok: false, code: "project-file.download-failed" };
  }
}
