/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
const io = vi.hoisted(() => ({ context: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/plans" }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: io.context }));
import PlansPage, { metadata } from "@/app/(marketing)/plans/page";
import { AI_RATE_CARD } from "../aiRateCard";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetAllMocks(); });

async function renderPage() {
  vi.stubGlobal("fetch", io.fetch);
  vi.stubEnv("AXIOM_SELF_SERVICE_BILLING_ENABLED", "false");
  return render(await PlansPage({}));
}

describe("Get started page (/plans)", () => {
  it("presents the three parts with honest calls to action", async () => {
    await renderPage();
    for (const heading of ["Free to explore", "Prepaid credits, the only paid part", "Scoped evaluation"]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(screen.getByRole("link", { name: "Create workspace" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "See AI rates" }).getAttribute("href")).toBe("#ai-rates");
    expect(screen.getByRole("link", { name: "Talk to us" }).getAttribute("href")).toBe("/contact");
    expect(screen.getByText("Cost shown before each action")).toBeTruthy();
    expect(screen.getByText("Never charged more than you prepaid")).toBeTruthy();
    expect(metadata.title).toBe("Get started with Axiom");
  });

  it("shows exact per-model rates from the rate card before any charge", async () => {
    await renderPage();
    const table = screen.getByRole("table", { name: /Per-model AI rates/ });
    const row = within(table).getByRole("row", { name: /Claude Sonnet 5\.5/ });
    expect(row.textContent).toContain("$3.00 / 1M tokens");
    expect(row.textContent).toContain("$0.15 / 1M tokens");
    expect(row.textContent).toContain("$15.00 / 1M tokens");
    expect(screen.getByText(AI_RATE_CARD.version)).toBeTruthy();
    expect(document.body.textContent).toContain("Customer price is 1.5× the provider's published token cost.");
    expect(document.body.textContent).toContain("cost $0.09 at provider rates, so you pay $0.14");
  });

  it("states limits, the refund rule and billing disclosures", async () => {
    await renderPage();
    const text = document.body.textContent ?? "";
    expect(text).toContain("10 counted deployments per organization each month");
    expect(text).toContain("Unused prepaid balance is refundable on request within 30 days of purchase.");
    expect(text).toContain("A failed action is released automatically; you are not charged for it.");
    for (const line of AI_RATE_CARD.disclosures) expect(text).toContain(line);
    expect(text).toContain("$10.00 prepaid: $10.00 of AI usage ($6.66 of provider cost)");
    expect(text).toContain("Bring your own key (BYOK) available in enterprise evaluations");
    expect(text).toMatch(/30–60 days/);
  });

  it("shows no seat prices, seat plans or upgrade pressure", async () => {
    await renderPage();
    const text = document.body.textContent ?? "";
    for (const banned of ["$29", "$23.20", "$79", "$63.20", "per user", "per seat", "Choose Pro", "Choose Enterprise", "Recommended", "Annual · save 20%", "Upgrade"]) {
      expect(text).not.toContain(banned);
    }
    expect(screen.queryByRole("button")).toBeNull();
    expect(io.context).not.toHaveBeenCalled();
    expect(io.fetch).not.toHaveBeenCalled();
  });
});

describe("Get started page per-level cost ranges", () => {
  it("shows an estimated range for each AI level, labelled as an estimate", async () => {
    await renderPage();
    const table = screen.getByRole("table", { name: /Estimated cost per action by AI level/ });
    for (const [level, range] of [["Inspect", "$0.01 – $0.31"], ["Engineer", "$0.01 – $0.61"], ["DeepOps", "$0.01 – $0.91"]]) {
      const row = within(table).getByRole("row", { name: new RegExp(level) });
      expect(row.textContent).toContain(range);
    }
    expect(screen.getByText(/Every level uses the same 1.5x/)).toBeTruthy();
  });
});
