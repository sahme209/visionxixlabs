// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { INTEGRATION_LOGOS } from "../integrationLogos";
import { PUBLIC_AVAILABILITY } from "@/lib/integrations/publicIntegrationCatalog";
import { WorksWithStrip } from "@/components/marketing/WorksWithStrip";
import { IntegrationsHubFlow } from "@/components/marketing/IntegrationsHubFlow";

afterEach(cleanup);

describe("integration logos are honest", () => {
  it("every logo file exists and statuses come from the public catalog", () => {
    for (const i of INTEGRATION_LOGOS) {
      if (i.logo) expect(existsSync(join(process.cwd(), "public", i.logo))).toBe(true);
      if (PUBLIC_AVAILABILITY[i.id]) expect(i.status).toBe(PUBLIC_AVAILABILITY[i.id].label);
    }
  });

  it("the home strip never shows planned integrations and says logos are not endorsements", () => {
    render(createElement(WorksWithStrip));
    for (const i of INTEGRATION_LOGOS.filter((x) => x.status === "planned")) expect(screen.queryByText(i.name)).toBeNull();
    expect(screen.queryByAltText("GitLab")).toBeNull();
    expect(screen.getByAltText("GitHub")).toBeTruthy();
    expect(screen.getByText(/do not imply endorsement/)).toBeTruthy();
    expect(screen.getByText("Works with the tools you already use")).toBeTruthy();
  });

  it("the Integrations flow shows every tool with its real status, Axiom checks and outcomes", () => {
    render(createElement(IntegrationsHubFlow));
    expect(screen.getByRole("list", { name: "Tools" })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Axiom checks" }).textContent).toMatch(/Policy and approval/);
    expect(screen.getByRole("list", { name: "Outcomes" }).textContent).toMatch(/governed deployment/);
    expect(screen.getAllByText("planned").length).toBeGreaterThan(0);
    expect(screen.getByText(/do not imply endorsement/)).toBeTruthy();
  });
});
