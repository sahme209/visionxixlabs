/**
 * Locks in a batch of real accessibility defects found and fixed in the
 * dashboard's floating/overlay widgets (CommandPalette, ProfileMenu,
 * FeedbackWidget, ContextualHelpBubble) — the earlier accessibility
 * pass covered signin/signup/contact but hadn't yet reached these
 * dashboard-only, signed-in-companion surfaces.
 *
 * Source-text assertion, not a render test — see
 * providersReducedMotion.test.ts for why (plain Node vitest env here).
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
}

describe("CommandPalette — accessibility", () => {
  const src = source("app/dashboard/CommandPalette.tsx");

  it("labels the dialog instead of leaving it an unannounced role=dialog", () => {
    expect(src).toContain('aria-label="Command palette"');
  });

  it("traps Tab focus inside the dialog", () => {
    expect(src).toContain('if (e.key === "Tab")');
    expect(src).toContain("dialogRef.current?.querySelectorAll");
  });

  it("returns focus to whatever triggered the palette on close", () => {
    expect(src).toContain("previouslyFocusedRef.current = document.activeElement");
    expect(src).toContain("previouslyFocusedRef.current?.focus();");
  });

  it("exposes the active command via combobox/listbox semantics, not just a visual highlight", () => {
    expect(src).toContain('role="combobox"');
    expect(src).toContain('role="listbox"');
    expect(src).toContain('role="option"');
    expect(src).toContain("aria-activedescendant");
    expect(src).toContain('aria-selected={active}');
  });

  it("announces the result count to screen readers as the query changes", () => {
    expect(src).toMatch(/role="status" aria-live="polite"/);
  });
});

describe("ProfileMenu — accessibility", () => {
  const src = source("app/dashboard/ProfileMenu.tsx");

  it("closes on Escape and returns focus to the trigger (previously had no keydown handling at all)", () => {
    expect(src).toContain('e.key === "Escape"');
    expect(src).toContain("triggerRef.current?.focus()");
  });
});

describe("FeedbackWidget — accessibility", () => {
  const src = source("app/dashboard/FeedbackWidget.tsx");

  it("announces its error the same way signin/signup/contact already do", () => {
    expect(src).toMatch(/role="alert" aria-live="assertive"[^>]*>\{error\}/);
  });

  it("announces its success confirmation as a polite status region", () => {
    expect(src).toContain('role="status" aria-live="polite" className="text-center py-4"');
  });

  it("closes on Escape and returns focus to the trigger", () => {
    expect(src).toContain('e.key === "Escape"');
    expect(src).toContain("triggerRef.current?.focus()");
  });
});

describe("ContextualHelpBubble — accessibility", () => {
  const src = source("app/dashboard/ContextualHelpBubble.tsx");

  it("returns focus to the trigger on Escape-close (previously closed without refocusing)", () => {
    expect(src).toContain("triggerRef.current?.focus()");
  });

  it("labels the popover panel itself, not just the trigger button", () => {
    expect(src).toContain('role="dialog" aria-label="Help"');
  });
});

describe("RouteAnnouncer — sitewide route-transition announcement", () => {
  const src = source("components/a11y/RouteAnnouncer.tsx");
  const layout = source("app/layout.tsx");

  it("announces document.title after a navigation via a polite live region", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain("document.title");
  });

  it("skips announcing on first render (the page's own initial load already does this)", () => {
    expect(src).toContain("isFirstRender");
  });

  it("is mounted once at the root layout, covering every route including the dashboard", () => {
    expect(layout).toContain('import { RouteAnnouncer } from "@/components/a11y/RouteAnnouncer";');
    expect(layout).toContain("<RouteAnnouncer />");
  });
});
