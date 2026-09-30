import { describe, expect, it } from "vitest";
import { integrationInventory, tauriCapabilities } from "../tauriCapabilityInventory";

describe("Axiom Agent public capability inventory", () => {
    it("classifies every public capability and documents evidence and limitations", () => {
        expect(tauriCapabilities.length).toBeGreaterThanOrEqual(8);
        for (const capability of tauriCapabilities) {
            expect(["working_tested", "implemented_unverified", "demo_sandbox", "planned_blocked"]).toContain(capability.state);
            expect(capability.publicDescription.length).toBeGreaterThan(20);
            expect(capability.evidence.length).toBeGreaterThan(0);
            expect(capability.limitation.length).toBeGreaterThan(20);
        }
    });

    it("advertises only the verified desktop distribution with its limitations", () => {
        const distribution = tauriCapabilities.find((item) => item.id === "desktop-distribution");
        expect(distribution?.state).toBe("working_tested");
        expect(distribution?.publicDescription).toContain("installable desktop application");
        expect(distribution?.limitation).toContain("changed source");
        expect(distribution?.limitation).toContain("clean-host installation");
    });

    it("states a setup requirement for every integration", () => {
        expect(integrationInventory.length).toBeGreaterThan(0);
        for (const integration of integrationInventory) {
            expect(integration.note.length).toBeGreaterThan(20);
        }
    });
});
