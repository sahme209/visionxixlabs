import {useEffect, type RefObject} from "react";

export function useSearchShortcut(searchField: RefObject<HTMLInputElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    function focusSearch(event: KeyboardEvent) {
      if (event.key !== "/" || event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && (event.target.closest('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="alertdialog"]')
        || (event.target instanceof HTMLElement && event.target.isContentEditable))) return;
      const field = searchField.current;
      if (!field) return;
      field.focus();
      if (document.activeElement === field) event.preventDefault();
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [active, searchField]);
}
