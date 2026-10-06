import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findMembership: vi.fn(),
  upsertMembership: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: { orgMembership: { findUnique: mocks.findMembership, upsert: mocks.upsertMembership } },
}));

import { currentContext } from "@/lib/auth/currentContext";

describe("current workspace authority contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "operator@example.test", roles: ["owner"] },
    });
    // Self-heal bootstrap retry succeeds but finds nothing new by
    // default — individual tests override findMembership's second
    // call to simulate a membership appearing after the retry.
    mocks.upsertMembership.mockResolvedValue(undefined);
  });

  it("does not recover workspace authority from a stale login-session role, even after the bootstrap retry finds nothing", async () => {
    mocks.findMembership.mockResolvedValue(null);

    await expect(currentContext()).resolves.toMatchObject({
      isAuthenticated: true,
      roles: [],
    });
    // The self-heal retry must have been attempted (own derived workspace).
    expect(mocks.upsertMembership).toHaveBeenCalledTimes(1);
  });

  it("uses the current durable membership role without needing the bootstrap retry", async () => {
    mocks.findMembership.mockResolvedValue({ role: "admin" });

    await expect(currentContext()).resolves.toMatchObject({
      isAuthenticated: true,
      roles: ["admin"],
    });
    expect(mocks.upsertMembership).not.toHaveBeenCalled();
  });

  it("self-heals when the one-time sign-in bootstrap had silently failed", async () => {
    // First lookup (pre-retry) finds nothing — the sign-in bootstrap
    // never created the row. After the retry's upsert, the row exists.
    mocks.findMembership
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: "owner" });

    await expect(currentContext()).resolves.toMatchObject({
      isAuthenticated: true,
      roles: ["owner"],
    });
    expect(mocks.upsertMembership).toHaveBeenCalledTimes(1);
  });

  it("still returns no roles, fail-closed, when the bootstrap retry itself fails", async () => {
    mocks.findMembership.mockResolvedValue(null);
    mocks.upsertMembership.mockRejectedValue(new Error("db unavailable"));

    await expect(currentContext()).resolves.toMatchObject({
      isAuthenticated: true,
      roles: [],
    });
  });
});
