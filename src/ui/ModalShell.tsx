import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ModalShellProps {
  readonly children: ReactNode;
  readonly fallbackFocusIds?: readonly string[];
  readonly initialFocusId?: string;
  readonly onRequestClose: () => void;
  readonly returnScrollPosition?: { readonly left: number; readonly top: number };
  readonly title: string;
}

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function ModalShell({
  children,
  fallbackFocusIds = [],
  initialFocusId,
  onRequestClose,
  returnScrollPosition,
  title,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const fallbackFocusIdsRef = useRef(fallbackFocusIds);
  const titleId = `modal-title-${title.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  useLayoutEffect(() => {
    const app = document.querySelector<HTMLElement>(".app-shell");
    app?.setAttribute("inert", "");
    document.documentElement.classList.add("modal-active");
    return () => {
      app?.removeAttribute("inert");
      document.documentElement.classList.remove("modal-active");
    };
  }, []);

  useEffect(() => {
    const opener = openerRef.current;
    const openerViewportY = opener?.getBoundingClientRect().y;
    const fallbackFocusIdsAtOpen = fallbackFocusIdsRef.current;
    const returnScroll = returnScrollPosition ?? { left: window.scrollX, top: window.scrollY };
    const preferred = initialFocusId === undefined
      ? null
      : document.getElementById(initialFocusId);
    const fallback = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (preferred ?? fallback ?? dialogRef.current)?.focus({ preventScroll: true });
    window.scrollTo(returnScroll.left, returnScroll.top);
    const openFrame = window.requestAnimationFrame(() => {
      window.scrollTo(returnScroll.left, returnScroll.top);
    });
    return () => {
      window.cancelAnimationFrame(openFrame);
      const fallbackTarget = fallbackFocusIdsAtOpen
        .map((id) => document.getElementById(id))
        .find((element): element is HTMLElement => element instanceof HTMLElement && element.isConnected);
      const openerIsUsable =
        opener?.isConnected === true &&
        opener !== document.body &&
        opener !== document.documentElement &&
        opener.getClientRects().length > 0 &&
        opener.closest("[hidden], [inert]") === null;
      const returnTarget = openerIsUsable ? opener : fallbackTarget;
      returnTarget?.focus({ preventScroll: true });
      window.scrollTo(returnScroll.left, returnScroll.top);
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
        if (openerIsUsable && openerViewportY !== undefined) {
          window.scrollBy(0, opener.getBoundingClientRect().y - openerViewportY);
        } else {
          window.scrollTo(returnScroll.left, returnScroll.top);
        }
      });
    };
  }, [initialFocusId, returnScrollPosition]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    ).filter((element) => element.getAttribute("aria-disabled") !== "true");
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="modal-shell__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" aria-label={`${title}を閉じる`} onClick={onRequestClose}>
            ×
          </button>
        </header>
        <div className="modal-shell__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
