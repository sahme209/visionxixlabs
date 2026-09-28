import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pairing: vi.fn(),
  session: vi.fn(),
  billing: vi.fn(),
  request: vi.fn(),
  playbook: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    desktopPairingChallengeRecord: { findFirst: mocks.pairing },
    desktopSessionRecord: { findFirst: mocks.session },
    tenantBillingPlan: { findFirst: mocks.billing },
    tauriDeploymentRequest: { findFirst: mocks.request },
    tauriPlaybook: { findFirst: mocks.playbook },
  },
}));

import { readDesktopRuntimeReadiness } from "@/lib/desktop/desktopRuntimeReadiness";

describe("desktop runtime readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const probe of Object.values(mocks)) probe.mockResolvedValue(null);
  });

  it("allows distribution when every required store is queryable, even when empty", async () => {
    await expect(readDesktopRuntimeReadiness()).resolves.toEqual({ ready: true });
    for (const probe of Object.values(mocks)) {
      expect(probe).toHaveBeenCalledWith({ select: { id: true } });
    }
  });

  it("fails closed without exposing database details when any required store is unavailable", async () => {
    mocks.pairing.mockRejectedValue(new Error("relation DesktopPairingChallengeRecord does not exist"));

    const result = await readDesktopRuntimeReadiness();

    expect(result.ready).toBe(false);
    expect(result.message).toContain("desktop sign-in is temporarily unavailable");
    expect(result.message).not.toContain("DesktopPairingChallengeRecord");
  });
});
