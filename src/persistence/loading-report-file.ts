export const LOADING_REPORT_PDF_FILENAME = "auto-clp-loading-report.pdf";

export type LoadingReportFileFailureCode =
  | "report-pdf.download-unavailable"
  | "report-pdf.download-failed";

export type LoadingReportFileResult =
  | { readonly ok: true }
  | { readonly code: LoadingReportFileFailureCode; readonly ok: false };

export function isLoadingReportDownloadAvailable(): boolean {
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

export function downloadLoadingReportPdf(
  bytes: Uint8Array,
): LoadingReportFileResult {
  if (!isLoadingReportDownloadAvailable()) {
    return { code: "report-pdf.download-unavailable", ok: false };
  }
  let objectUrl: string | undefined;
  let anchor: HTMLAnchorElement | undefined;
  const revoke = () => {
    if (objectUrl === undefined) return;
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Revocation is best-effort after the download request.
    }
  };
  try {
    const ownedBytes = new Uint8Array(bytes.byteLength);
    ownedBytes.set(bytes);
    objectUrl = URL.createObjectURL(
      new Blob([ownedBytes.buffer], { type: "application/pdf" }),
    );
    anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = LOADING_REPORT_PDF_FILENAME;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    revoke();
    return { ok: true };
  } catch {
    anchor?.remove();
    revoke();
    return { code: "report-pdf.download-failed", ok: false };
  }
}
