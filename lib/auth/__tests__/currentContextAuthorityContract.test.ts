import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findMembership: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({
  prisma: { orgMembership: { findUnique: mocks.findMembership } },
}));

import { currentContext } from "@/lib/auth/currentContext";

describe("current workspace authority contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "operator@example.test", roles: ["owner"] },
    });
  });

  it("does not recover workspace authority from a stale login-session role", async () => {
    mocks.findMembership.mockResolvedValue(null);

    await expect(currentContext()).resolves.toMatchObject({
      isAuthenticated: true,
      roles: [],
    });
  });

  it("uses the current durable membership role", async () => {
    mocks.findMembership.mockResolvedValue({ role: "admin" });

    await expect(currentContext()).resolves.toMatchObject({
      isAuthenticated: true,
      roles: ["admin"],
    });
  });
});
