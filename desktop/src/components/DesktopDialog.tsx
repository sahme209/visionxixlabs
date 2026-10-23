import { useEffect, useRef, type ReactNode } from "react";

const focusableControls = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';

/** Keeps keyboard review inside the dialog and restores the caller's focus.
 * Busy means an action may be in flight; Escape never implies it was canceled. */
export function DesktopDialog({ label, onClose, busy = false, children }: {
  label: string;
  onClose: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>(focusableControls)?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  return <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}
  >
    <section
      ref={dialog}
      role="alertdialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="w-full max-w-md rounded-xl border border-white/10 bg-[#181a1d] p-5 shadow-2xl"
      onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (!busy) onClose();
        }
        if (event.key !== "Tab") return;
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>(focusableControls) ?? [])
          .filter(element => !element.closest('[hidden], [inert]'));
        const first = elements[0], last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.current?.focus();
        } else if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }}
    >{children}</section>
  </div>;
}
