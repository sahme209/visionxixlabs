import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("mobile website contract", () => {
  it("uses a dedicated mobile homepage instead of compressing the desktop page", () => {
    const page = source("app/page.tsx");
    const mobileHome = source("components/home/MobileHome.tsx");

    expect(page).toContain("<MobileHome />");
    expect(page).toContain('<div className="hidden md:block">');
    expect(mobileHome).toContain('<main className="md:hidden overflow-x-clip">');
    expect(mobileHome).toContain("Your request becomes the playbook.");
  });

  it("keeps primary mobile actions large and full width", () => {
    const mobileHome = source("components/home/MobileHome.tsx");

    expect(mobileHome).toContain("min-h-12 w-full");
    expect(mobileHome).toContain("Get the desktop app");
    expect(mobileHome).toContain("Explore the isolated demo");
  });

  it("uses a concise mobile menu and locks both root scroll containers", () => {
    const navigation = source("components/Navigation.tsx");

    expect(navigation).toContain("const mobileLinks = [");
    expect(navigation).toContain('document.body.style.overflow = "hidden"');
    expect(navigation).toContain('document.documentElement.style.overflow = "hidden"');
    expect(navigation).toContain('min-h-[60px]');
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

  it("uses a compact phone footer instead of desktop link directories", () => {
    const footer = source("components/Footer.tsx");

    expect(footer).toContain('<div className="md:hidden mb-10">');
    expect(footer).toContain("hidden md:grid md:grid-cols-5");
    expect(footer).toContain("Deployment operations belong in the desktop app.");
  });
});
