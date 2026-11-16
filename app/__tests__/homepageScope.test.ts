// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@heroicons/react/24/outline", () => ({
  ArrowRightIcon: () => null, ClockIcon: () => null, CpuChipIcon: () => null,
  FingerPrintIcon: () => null, LinkIcon: () => null, ScaleIcon: () => null, ShieldCheckIcon: () => null,
}));
vi.mock("@/components/Navigation", () => ({ Navigation: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/marketing/HomepageMediaShowcase", () => ({ HomepageMediaShowcase: () => createElement("div", { "data-testid": "media-stage" }) }));
vi.mock("@/components/marketing/CinematicAxiomDemo", () => ({ CinematicAxiomDemo: () => null }));
import Home from "../page";

afterEach(cleanup);

describe("homepage scope", () => {
  it("places availability and assessment links before the demo", async () => {
    render(await Home());
    const availability = screen.getByText(/Actual actions depend on the installed version, current permissions, and enabled workflow/);
    expect(availability.textContent).toContain("Complete Governance enforcement and activation are not established");
    for (const [name, href] of [["Assess security boundaries", "/security"], ["Read the approval workflow", "/docs/approval-workflow"]]) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(href);
      expect(Boolean(link.compareDocumentPosition(screen.getByTestId("media-stage")) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    }
    expect(Boolean(availability.compareDocumentPosition(screen.getByTestId("media-stage")) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("bounds illustrative claims and distinguishes records from verified outcomes", async () => {
    const { container } = render(await Home());
    expect(container.textContent).not.toMatch(/never executes a write by itself|interface never invents certainty/i);
    expect(screen.getByText(/These boards are conceptual examples/).textContent).toContain("A saved request, approval, or workflow is not a verified provider result, application health, or rollback proof");
    expect(screen.getAllByText("Illustrated record · sample data")).toHaveLength(3);
    expect(screen.getByText("Workflow accepted")).toBeTruthy();
    expect(screen.getByText("No result yet")).toBeTruthy();
    expect(screen.getByText("Instruction recorded")).toBeTruthy();
  });

  it("preserves acquisition destinations and makes the tour boundary explicit", async () => {
    render(await Home());
    for (const [name, href] of [["Explore V19", "/product"], ["Explore the scripted tour", "/demo"], ["Download V19", "/download"], ["Meet the Founding Supporters program", "/support"]]) {
      const links = screen.getAllByRole("link", { name });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) expect(link.getAttribute("href")).toBe(href);
    }
  });
});
