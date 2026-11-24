import { useEffect, useRef, type ReactNode } from "react";

const focusableControls = 'button, input, select, textarea, a[href], summary, [tabindex], [contenteditable="true"]';

function tabbableControls(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableControls)).filter(element => {
    if (element.tabIndex < 0 || element.matches(":disabled") || element.closest("[hidden], [inert]")) return false;
    if (getComputedStyle(element).visibility !== "visible") return false;
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).display === "none") return false;
      if (ancestor === dialog) break;
      if (ancestor.tagName === "DETAILS" && !ancestor.hasAttribute("open") && element !== ancestor.firstElementChild) return false;
    }
    return true;
  });
}

function isolateBackground(overlay: HTMLElement) {
  const changed: Element[] = [];
  for (let branch: Element | null = overlay; branch?.parentElement && branch !== document.body; branch = branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling === branch || sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      changed.push(sibling);
    }
  }
  return () => changed.forEach(element => element.removeAttribute("inert"));
}

/** Keeps keyboard review inside the dialog and restores the caller's focus.
 * Busy means an action may be in flight; Escape never implies it was canceled. */
export function DesktopDialog({ label, onClose, busy = false, side = false, overlayClassName = "", role = "alertdialog", isolate = false, restoreFocus, children }: {
  label: string;
  onClose: () => void;
  busy?: boolean;
  side?: boolean;
  overlayClassName?: string;
  role?: "dialog" | "alertdialog";
  isolate?: boolean;
  restoreFocus?: () => boolean;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const restore = useRef(restoreFocus);
  restore.current = restoreFocus;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialog.current;
    const restoreBackground = isolate && overlay.current ? isolateBackground(overlay.current) : undefined;
    if (panel) (tabbableControls(panel)[0] ?? panel).focus();
    return () => {
      restoreBackground?.();
      if (!restore.current?.() && previous?.isConnected) previous.focus();
    };
  }, [isolate]);

  return <div
    ref={overlay}
    className={`fixed inset-0 z-50 flex bg-black/70 ${side ? "justify-end" : "items-center justify-center p-6"} ${overlayClassName}`}
    onMouseDown={event => {
      if (!busy && event.target === event.currentTarget) {
        event.preventDefault();
        onClose();
      }
    }}
  >
    <section
      ref={dialog}
      role={role}
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={`w-full max-w-md border border-white/10 p-5 shadow-2xl ${side ? "overflow-y-auto bg-axiom-bg-elev" : "rounded-xl bg-[#181a1d]"}`}
      onKeyDown={event => {
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onClose();
        }
        if (event.key !== "Tab") return;
        const elements = dialog.current ? tabbableControls(dialog.current) : [];
        const first = elements[0], last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.current?.focus();
        } else if (event.shiftKey && (document.activeElement === first || !elements.some(element => element === document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !elements.some(element => element === document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }}
    >{children}</section>
  </div>;
}
