import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("desktop homepage presentation contract", () => {
  it("uses intentional headline lines without character-level word breaks", () => {
    const page = source("app/page.tsx");

    expect(page).toContain('text="Your request" splitBy="word"');
    expect(page).toContain('text="becomes the" splitBy="word"');
    expect(page).toContain('text="playbook." splitBy="word"');
    expect(page).not.toContain('text="becomes the playbook." splitBy="char"');
  });

  it("aligns navigation and hero to the same wide desktop grid", () => {
    const page = source("app/page.tsx");
    const navigation = source("components/Navigation.tsx");

    expect(page).toContain('max-w-[1400px]');
    expect(navigation).toContain('max-w-[1400px]');
    expect(navigation).toContain('lg:flex');
    expect(navigation).toContain('lg:hidden');
    expect(navigation).toContain('(min-width: 1024px)');
  });

  it("keeps the hero atmosphere calm and removes the split-screen beam", () => {
    const page = source("app/page.tsx");
    const styles = source("app/globals.css");

    expect(page).toContain('hero-atmosphere');
    expect(page).not.toContain('hero-beam-vertical');
    expect(page).not.toContain('hero-beam-flare');
    expect(page).not.toContain('hero-beam-converge');
    expect(styles).toContain('.hero-product-shell');
  });

  it("gives the product walkthrough a complete operational frame", () => {
    const page = source("app/page.tsx");
    const walkthrough = source("components/marketing/HomepageDemoAnimation.tsx");

    expect(page).toContain('Axiom Agent walkthrough');
    expect(page).toContain('Installed workspace · illustrative data');
    expect(page).toContain('Approval gated');
    expect(page).toContain('Explicit outcomes');
    expect(page).toContain('Persisted trail');
    expect(walkthrough).toContain('Deployment playbook progress');
    expect(walkthrough).toContain('const PLAYBOOK_STAGES = ["Intake", "Approve", "Execute", "Validate"]');
  });

  it("uses a quiet support control instead of the oversized glowing pill", () => {
    const chat = source("components/AIChatWidget.tsx");

    expect(chat).toContain('Ask Axiom');
    expect(chat).not.toContain('chat-bubble-glow');
    expect(chat).not.toContain('Let&apos;s chat');
  });
});
