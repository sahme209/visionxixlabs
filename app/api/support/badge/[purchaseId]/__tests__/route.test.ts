import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createBadgeToken } from "@/lib/supporters/core";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { foundingSupporterPurchase: { findUnique: mocks.findUnique } } }));

import { GET } from "../route";

function request(token: string) {
  return new NextRequest(`https://visionxixlabs.com/api/support/badge/support_1?token=${encodeURIComponent(token)}`);
}

describe("GET /api/support/badge/[purchaseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPPORTER_BADGE_SIGNING_SECRET = "badge-secret";
    mocks.findUnique.mockResolvedValue({ id: "support_1", displayName: "A & B", status: "paid", paidAt: new Date("2026-10-13T00:00:00Z") });
  });

  it("serves a private signed badge for a paid supporter", async () => {
    const token = createBadgeToken("support_1", "badge-secret");
    const response = await GET(request(token), { params: Promise.resolve({ purchaseId: "support_1" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(await response.text()).toContain("A &amp; B");
  });

  it("denies badge access after a full refund", async () => {
    mocks.findUnique.mockResolvedValue({ id: "support_1", status: "refunded" });
    const token = createBadgeToken("support_1", "badge-secret");
    expect((await GET(request(token), { params: Promise.resolve({ purchaseId: "support_1" }) })).status).toBe(404);
  });

  it("denies a forged badge token without querying purchase data", async () => {
    expect((await GET(request("forged"), { params: Promise.resolve({ purchaseId: "support_1" }) })).status).toBe(404);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
