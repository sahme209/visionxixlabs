// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkflowEvidenceMap } from "../WorkflowEvidenceMap";
import { CinematicAxiomDemo } from "../CinematicAxiomDemo";
beforeEach(() => { vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function key(target: Element, key: string, init: KeyboardEventInit = {}) { const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }); act(() => { target.dispatchEvent(event); }); return event; }
const exceptions: KeyboardEventInit[] = [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { isComposing: true }, { keyCode: 229 }];
for (const kind of ["workflow", "playback"] as const) {
 function mount() { render(createElement(kind === "workflow" ? WorkflowEvidenceMap : CinematicAxiomDemo)); const controls = kind === "workflow" ? screen.getAllByRole("button") : within(screen.getByRole("group", { name: "Story playback" })).getAllByRole("button"); const target = kind === "workflow" ? controls[1] : screen.getByRole("button", { name: "Replay story" }); if (kind === "workflow") fireEvent.click(target); else fireEvent.click(screen.getByRole("button", { name: /Step 2:/ })); target.focus(); return target; }
 function selected() { return kind === "workflow" ? screen.getAllByRole("button").find(b => b.getAttribute("aria-pressed") === "true")?.id : screen.getByRole("status", { name: "Current story step" }).textContent; }
 for (const init of exceptions) it(kind + " preserves modified or composing navigation " + JSON.stringify(init), () => {
  const target = mount(); const initial = selected();
  for (const name of ["ArrowLeft", "ArrowRight", "Home", "End", ...(kind === "workflow" ? ["ArrowUp", "ArrowDown"] : [])]) { const event = key(target, name, init); expect(event.defaultPrevented).toBe(false); expect(selected()).toBe(initial); expect(document.activeElement).toBe(target); }
 });
 it(kind + " retains plain navigation and unrelated keys", () => { const target = mount(); const initial = selected(); expect(key(target, "a").defaultPrevented).toBe(false); expect(selected()).toBe(initial); expect(key(target, "End").defaultPrevented).toBe(true); expect(selected()).not.toBe(initial); if (kind === "workflow") expect(document.activeElement).toBe(screen.getAllByRole("button")[4]); else expect(document.activeElement).toBe(target); expect(key(document.activeElement!, "Home").defaultPrevented).toBe(true); });
}
it("playback leaves outside inputs alone", () => { render(createElement(CinematicAxiomDemo)); const select = screen.getByRole("combobox", { name: "Repository" }); select.focus(); const before = screen.getByRole("status", { name: "Current story step" }).textContent; expect(key(select, "End").defaultPrevented).toBe(false); expect(screen.getByRole("status", { name: "Current story step" }).textContent).toBe(before); expect(document.activeElement).toBe(select); });
