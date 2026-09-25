import { describe, expect, it } from "vitest";
import { integrationInventory, tauriCapabilities } from "../tauriCapabilityInventory";

describe("TAURI public capability inventory", () => {
    it("classifies every public capability and documents evidence and limitations", () => {
        expect(tauriCapabilities.length).toBeGreaterThanOrEqual(8);
        for (const capability of tauriCapabilities) {
            expect(["working_tested", "demo_sandbox", "planned_blocked"]).toContain(capability.state);
            expect(capability.publicDescription.length).toBeGreaterThan(20);
            expect(capability.evidence.length).toBeGreaterThan(0);
            expect(capability.limitation.length).toBeGreaterThan(20);
        }
    });

    it("does not advertise the desktop installer as available", () => {
        expect(tauriCapabilities.find((item) => item.id === "desktop-distribution")?.state).toBe("planned_blocked");
    });

    it("states a setup requirement for every integration", () => {
        expect(integrationInventory.length).toBeGreaterThan(0);
        for (const integration of integrationInventory) {
            expect(integration.note.length).toBeGreaterThan(20);
        }
    });
});
