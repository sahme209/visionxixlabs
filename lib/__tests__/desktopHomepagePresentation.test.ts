import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("desktop homepage presentation contract", () => {
  it("uses a direct, stable headline without character-level animation", () => {
    const page = source("app/page.tsx");

    expect(page).toContain("Turn the request into the playbook.");
    expect(page).not.toContain("SplitText");
    expect(page).not.toContain('splitBy="char"');
  });

  it("aligns navigation and hero to the same wide desktop grid", () => {
    const page = source("app/page.tsx");
    const navigation = source("components/Navigation.tsx");

    expect(page).toContain('max-w-[1720px]');
    expect(navigation).toContain('max-w-[1720px]');
    expect(navigation).toContain('lg:flex');
    expect(navigation).toContain('lg:hidden');
  });

  it("keeps the hero atmosphere calm and removes the split-screen beam", () => {
    const page = source("app/page.tsx");
    expect(page).toContain('bg-[#0d0d0b]');
    expect(page).not.toContain('hero-beam-vertical');
    expect(page).not.toContain('hero-beam-flare');
    expect(page).not.toContain('hero-beam-converge');
  });

  it("gives the product walkthrough a complete operational frame", () => {
    const page = source("app/page.tsx");
    expect(page).toContain('Illustrative workflow · no live action');
    expect(page).toContain('Awaiting approval');
    expect(page).toContain('Request version');
    expect(page).toContain('Content digest');
    expect(page).toContain('Last service response verified moments ago.');
  });

  it("uses a quiet support control instead of the oversized glowing pill", () => {
    const chat = source("components/AIChatWidget.tsx");

    expect(chat).toContain('Ask Axiom');
    expect(chat).not.toContain('chat-bubble-glow');
    expect(chat).not.toContain('Let&apos;s chat');
  });
});
