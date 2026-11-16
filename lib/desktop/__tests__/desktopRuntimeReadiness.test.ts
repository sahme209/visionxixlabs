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
    expect(mocks.pairing).toHaveBeenCalledWith({ select: { id: true } });
    expect(mocks.session).toHaveBeenCalledWith({ select: { id: true } });
    expect(mocks.billing).toHaveBeenCalledWith({ select: { organizationId: true } });
    expect(mocks.request).toHaveBeenCalledWith({ select: { id: true } });
    expect(mocks.playbook).toHaveBeenCalledWith({ select: { id: true } });
  });

  it("fails closed without exposing database details when any required store is unavailable", async () => {
    mocks.pairing.mockRejectedValue(new Error("relation DesktopPairingChallengeRecord does not exist"));

    const result = await readDesktopRuntimeReadiness();

    expect(result.ready).toBe(false);
    expect(result.message).toContain("Required service storage checks are unavailable");
    expect(result.message).toContain("Installation, sign-in, and entitlement still require separate verification");
    expect(result.message).not.toContain("storage is being prepared");
    expect(result.message).not.toContain("DesktopPairingChallengeRecord");
    const arguments_ = vi.mocked(console.error).mock.calls[0];
    expect(arguments_).toHaveLength(2);
    expect(arguments_[1]).toMatchObject({ databaseTraceRevision: "database-route-trace-v1", databaseClientRoute: "unknown-client", databaseObservationScope: "direct-client-only", tlsVerificationConfigured: null, channelBindingRequired: null });
    expect(Object.values(arguments_[1] as object).every(value => value === null || ["string", "number", "boolean"].includes(typeof value))).toBe(true);
    expect(result).not.toHaveProperty("databaseTraceRevision");
  });
});

it("never logs error text, stack, targets or object hooks", async () => {
  const marker = 'postgresql://SECRET_USER:SECRET_PASSWORD@SECRET_HOST/SECRET_DATABASE';
  const getter = vi.fn(() => { throw new Error(marker); });
  const toJSON = vi.fn(() => marker);
  const error = { code: '08P01', message: marker + ' unsupported startup parameter in options: search_path', stack: marker, toJSON };
  Object.defineProperty(error, 'cause', { get: getter });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.mocked(console.error).mockClear();
  for (const probe of Object.values(mocks)) probe.mockResolvedValue(null);
  mocks.pairing.mockRejectedValue(error);
  await expect(readDesktopRuntimeReadiness()).resolves.toMatchObject({ ready: false });
  const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
  for (const value of [marker, 'SECRET_USER', 'SECRET_PASSWORD', 'SECRET_HOST', 'SECRET_DATABASE']) expect(logged).not.toContain(value);
  expect(logged).toContain('startup_search_path_rejected');
  expect(getter).not.toHaveBeenCalled(); expect(toJSON).not.toHaveBeenCalled();
});
