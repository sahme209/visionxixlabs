import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("mobile website contract", () => {
  it("uses one responsive homepage with phone-first spacing and actions", () => {
    const page = source("app/page.tsx");

    expect(page).toContain("Turn the request into the playbook.");
    expect(page).toContain("flex flex-col gap-3 sm:flex-row");
    expect(page).toContain("grid min-h-[460px] lg:grid-cols");
  });

  it("keeps primary mobile actions large and full width", () => {
    const page = source("app/page.tsx");

    expect(page).toContain("min-h-12 items-center justify-center");
    expect(page).toContain("Download Axiom Agent");
    expect(page).toContain("Explore the isolated demo");
  });

  it("uses a concise mobile menu and locks both root scroll containers", () => {
    const navigation = source("components/Navigation.tsx");

    expect(navigation).toContain("const mobileLinks = [");
    expect(navigation).toContain('{ href: "/product", label: "Product" }');
    expect(navigation).toContain('{ href: "/capabilities", label: "Capabilities" }');
    expect(navigation).toContain('{ href: "/plans", label: "Pricing" }');
    expect(navigation).toContain('{ href: "/resources", label: "Resources" }');
    expect(navigation).toContain('{ href: "/integrations", label: "Integrations" }');
    expect(navigation).toContain('{ href: "/security", label: "Security" }');
    expect(navigation).toContain('{ href: "/status", label: "Status" }');
    expect(navigation).toContain('{ href: "/contact", label: "Contact" }');
    expect(navigation).toContain('document.body.style.overflow = "hidden"');
    expect(navigation).toContain('document.documentElement.style.overflow = "hidden"');
    expect(navigation).toContain('h-16');
    expect(navigation).not.toContain("Mobile navigation links\">\n                  <Link");
  });

  it("removes competing floating controls from phone layouts", () => {
    const layout = source("app/layout.tsx");
    const chat = source("components/AIChatWidget.tsx");

    expect(layout).not.toContain("<StickyMobileCTA");
    expect(chat).toContain("hidden md:flex");
  });

  it("keeps download and demo actions touch-sized and phone-shaped", () => {
    const download = source("app/download/page.tsx");
    const demo = source("app/demo/page.tsx");

    expect(download).toContain("min-h-12");
    expect(download).toContain("rounded-xl sm:rounded-full");
    expect(demo).toContain("min-h-12");
    expect(demo).not.toContain("transition-colors truncate");
  });

  it("uses a responsive footer that keeps links readable on phones", () => {
    const footer = source("components/Footer.tsx");

    expect(footer).toContain("grid gap-12 py-16 sm:grid-cols-2");
    expect(footer).toContain("flex flex-col items-center justify-center");
    expect(footer).toContain("Production access is service-verified");
  });
});
