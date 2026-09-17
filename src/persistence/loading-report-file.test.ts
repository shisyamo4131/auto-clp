import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadLoadingReportPdf,
  LOADING_REPORT_PDF_FILENAME,
} from "./loading-report-file";

const originalBlob = globalThis.Blob;
const originalDocument = globalThis.document;
const originalUrl = globalThis.URL;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "Blob", {
    configurable: true,
    value: originalBlob,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  });
  Object.defineProperty(globalThis, "URL", {
    configurable: true,
    value: originalUrl,
  });
});

describe("loading-report PDF download", () => {
  it("downloads PDF bytes through one fixed non-sensitive filename", () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = { click, download: "", hidden: false, href: "", remove };
    const append = vi.fn();
    const createObjectURL = vi.fn(() => "blob:anonymous-report");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        body: { append },
        createElement: vi.fn(() => anchor),
      },
    });
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: { createObjectURL, revokeObjectURL },
    });

    expect(downloadLoadingReportPdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toEqual({
      ok: true,
    });
    expect(anchor.download).toBe(LOADING_REPORT_PDF_FILENAME);
    expect(anchor.download).toBe("auto-clp-loading-report.pdf");
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:anonymous-report");
  });

  it("returns stable unavailable and failed results", () => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: undefined,
    });
    expect(downloadLoadingReportPdf(new Uint8Array())).toEqual({
      code: "report-pdf.download-unavailable",
      ok: false,
    });

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        body: { append: vi.fn() },
        createElement: vi.fn(() => {
          throw new Error("anonymous download failure");
        }),
      },
    });
    Object.defineProperty(globalThis, "URL", {
      configurable: true,
      value: {
        createObjectURL: vi.fn(() => "blob:anonymous-report"),
        revokeObjectURL: vi.fn(),
      },
    });
    expect(downloadLoadingReportPdf(new Uint8Array())).toEqual({
      code: "report-pdf.download-failed",
      ok: false,
    });
  });
});
