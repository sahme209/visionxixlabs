import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const header = readFileSync(join(process.cwd(), "components/auth/AuthCompanionHeader.tsx"), "utf8");

describe("signed-in companion navigation contract", () => {
  it("keeps every companion destination available in the compact mobile menu", () => {
    expect(header).toContain('href: "/auth/success", label: "Overview"');
    expect(header).toContain('href: "/account/integrations", label: "Integrations"');
    expect(header).toContain('href: "/account", label: "Settings"');
    expect(header).toContain('href: "/account/help", label: "Help"');
    expect(header).toContain('id="axiom-companion-menu"');
    expect(header).toContain('className="grid grid-cols-2 gap-2"');
  });

  it("keeps sign-out inside the signed-in companion shell", () => {
    expect(header).toContain('signOut({ callbackUrl: "/" })');
    expect(header).toContain('aria-label={mobileMenuOpen ? "Close companion menu" : "Open companion menu"}');
  });
});
