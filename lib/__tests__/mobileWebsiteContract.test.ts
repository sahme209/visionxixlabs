import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("mobile website contract", () => {
  it("uses one responsive homepage with phone-first spacing and actions", () => {
    const page = source("app/page.tsx");

    expect(page).toContain("<AxiomPublicHero />");
    expect(source("components/marketing/AxiomPublicHero.tsx")).toContain("Deploy with clarity.");
    expect(source("app/orbit-public.css")).toContain(".public-home-actions { display:flex; flex-wrap:wrap;");
    expect(page).toContain('<CinematicAxiomDemo variant="hero" />');
    expect(source("components/marketing/CinematicAxiomDemo.tsx")).toContain("lg:grid-cols-[230px_minmax(0,1fr)]");
  });

  it("keeps primary mobile actions touch-sized and preserves acquisition links", () => {
    const page = source("components/marketing/AxiomPublicHero.tsx");

    expect(source("app/orbit-public.css")).toContain(".public-home-actions :is(a) { min-height:44px;");
    expect(page).toContain("Download V19");
    expect(page).toContain("Explore the scripted tour");
  });

  it("uses a concise mobile menu and locks both root scroll containers", () => {
    const navigation = source("components/Navigation.tsx");

    expect(navigation).toContain("const mobileLinks = [");
    expect(navigation).toContain('{ href: "/product", label: "Product" }');
    expect(navigation).toContain('{ href: "/demo", label: "Demo" }');
    expect(navigation).toContain('{ href: "/integrations", label: "Integrations" }');
    expect(navigation).toContain('{ href: "/security", label: "Security" }');
    expect(navigation).toContain("...primaryLinks");
    expect(navigation).toContain("...secondaryLinks");
    expect(navigation).toContain('{ href: "/docs", label: "Docs" }');
    expect(navigation).toContain('{ href: "/account/help", label: "Support (account required)" }');
    expect(navigation).toContain('{ href: "/contact", label: "Contact" }');
    expect(navigation).toContain('{ href: "/status", label: "Status" }');
    expect(navigation).toContain('{ href: "/plans", label: "Get started" }');
    expect(navigation).toContain('{ href: "/support", label: "Founding Supporters" }');
    expect(navigation).toContain('document.body.style.overflow = "hidden"');
    expect(navigation).toContain('document.documentElement.style.overflow = "hidden"');
    expect(navigation).toContain('h-16');
    expect(navigation).not.toContain("Mobile navigation links\">\n                  <Link");
  });

  it("reserves the phone-width support launcher for Documentation", () => {
    const layout = source("app/layout.tsx");
    const chat = source("components/AIChatWidget.tsx");

    expect(layout).not.toContain("<StickyMobileCTA");
    expect(chat).toContain('pathname === "/docs" || pathname?.startsWith("/docs/")');
    expect(chat).toContain('inDocumentation ? "flex" : "hidden"');
    expect(chat).toContain('md:flex');
  });

  it("keeps download and demo actions touch-sized and phone-shaped", () => {
    const download = source("components/cockpit/DownloadContent.tsx");
    expect(source("app/download/page.tsx")).toContain("<DownloadContent />");
    const demo = source("app/demo/page.tsx");

    expect(download).toContain("min-h-12");
    expect(download).toContain("rounded-xl sm:rounded-full");
    expect(demo).toContain("min-h-12");
    expect(demo).not.toContain("transition-colors truncate");
  });

  it("uses a responsive footer that keeps links readable on phones", () => {
    const footer = source("components/Footer.tsx");

    expect(footer).toMatch(/aria-label="Footer navigation" className="[^"]*grid grid-cols-2[^"]*sm:grid-cols-3[^"]*lg:grid-cols-6/);
    expect(footer).toMatch(/<div key=\{column.title\} className="min-w-0">/);
    expect(footer).toMatch(/aria-label="Footer utilities" className="[^"]*flex-wrap[^"]*gap-x-4/);
    expect(footer).toContain("[@media(pointer:coarse)]:min-h-11");
    expect(footer).toMatch(/<Link href="\/status"[^>]*>Service status<\/Link>/);
  });
});
