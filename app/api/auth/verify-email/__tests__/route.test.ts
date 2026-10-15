import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// A narrow transaction model: writes outside the transaction commit immediately;
// transaction-local drafts commit together, or are discarded on an exception.
// The queue models competing conditional claims on one token's database row.
const model = vi.hoisted(() => ({
  token: null as null | { tokenHash: string; userId: string; usedAt: Date | null; expiresAt: Date },
  verifiedAt: null as Date | null,
  failUserUpdate: false,
  userUpdates: 0,
  queue: Promise.resolve() as Promise<unknown>,
}));
vi.mock("@/lib/db", () => {
  const repository = (draft?: { token: typeof model.token; verifiedAt: Date | null }) => ({
    emailVerificationToken: {
      updateMany: vi.fn(async ({ where, data }: { where: { tokenHash: string; usedAt: null; expiresAt: { gt: Date } }; data: { usedAt: Date } }) => {
        const token = draft ? draft.token : model.token;
        if (!token || token.tokenHash !== where.tokenHash || token.usedAt !== where.usedAt || token.expiresAt <= where.expiresAt.gt) return { count: 0 };
        token.usedAt = data.usedAt;
        return { count: 1 };
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const token = draft ? draft.token : model.token;
        return token?.tokenHash === where.tokenHash ? token : null;
      }),
    },
    user: { update: vi.fn(async ({ where, data }: { where: { id: string }; data: { emailVerifiedAt: Date } }) => {
      if (model.failUserUpdate) { model.failUserUpdate = false; throw new Error("temporary identity write outage"); }
      if (where.id !== "user-1") throw new Error("wrong identity");
      model.userUpdates += 1;
      if (draft) draft.verifiedAt = data.emailVerifiedAt;
      else model.verifiedAt = data.emailVerifiedAt;
      return { id: where.id };
    }) },
  });
  return { prisma: {
    ...repository(),
    $transaction: vi.fn((operation: (tx: ReturnType<typeof repository>) => Promise<boolean>) => {
      const result = model.queue.then(async () => {
        const draft = { token: model.token ? { ...model.token } : null, verifiedAt: model.verifiedAt };
        const outcome = await operation(repository(draft));
        model.token = draft.token;
        model.verifiedAt = draft.verifiedAt;
        return outcome;
      });
      model.queue = result.catch(() => undefined);
      return result;
    }),
  } };
});

import { hashEmailVerificationToken } from "@/lib/auth/emailVerification";
import { GET } from "../route";
const request = (token = "private-proof-token", callbackUrl?: string) => {
  const url = new URL("https://example.test/api/auth/verify-email");
  url.searchParams.set("token", token);
  if (callbackUrl) url.searchParams.set("callbackUrl", callbackUrl);
  return new NextRequest(url);
};
beforeEach(() => {
  model.token = { tokenHash: hashEmailVerificationToken("private-proof-token"), userId: "user-1", usedAt: null, expiresAt: new Date(Date.now() + 60_000) };
  model.verifiedAt = null;
  model.failUserUpdate = false;
  model.userUpdates = 0;
  model.queue = Promise.resolve();
});

describe("email proof commit boundary", () => {
  it("keeps proof usable when identity verification fails, then permits recovery with the same link", async () => {
    model.failUserUpdate = true;
    const first = await GET(request()).catch(() => null);
    expect(model.token?.usedAt).toBeNull();
    expect(model.verifiedAt).toBeNull();
    expect(first?.status).toBe(503);
    expect(await first?.text()).not.toContain("private-proof-token");
    const retry = await GET(request());
    expect(retry.status).toBe(307);
    expect(model.token?.usedAt).toEqual(model.verifiedAt);
    expect(model.userUpdates).toBe(1);
    expect(retry.headers.get("location")).toBe("https://example.test/auth/signin?verified=1");
  });
  it("allows only one concurrent claim and leaves replay denied", async () => {
    const responses = await Promise.all([GET(request()), GET(request())]);
    expect(responses.map((response) => response.status).sort()).toEqual([307, 400]);
    expect(model.userUpdates).toBe(1);
    expect((await GET(request())).status).toBe(400);
    expect(model.userUpdates).toBe(1);
  });
  it.each(["unknown", "expired", "used"])("rejects %s proof without verifying an identity", async (state) => {
    if (state === "unknown") model.token = null;
    if (state === "expired") model.token!.expiresAt = new Date(Date.now() - 1);
    if (state === "used") model.token!.usedAt = new Date();
    expect((await GET(request())).status).toBe(400);
    expect(model.verifiedAt).toBeNull();
    expect(model.userUpdates).toBe(0);
  });
  it.each(["", "a".repeat(513)])("rejects malformed proof before any claim", async (token) => {
    expect((await GET(request(token))).status).toBe(400);
    expect(model.token?.usedAt).toBeNull();
    expect(model.userUpdates).toBe(0);
  });
});

it("preserves sanitized navigation after proof without granting a session", async () => {
  const callback = "/desktop/connect?challenge=pair_123&intent=sign_up";
  const response = await GET(request("private-proof-token", callback));
  const destination = new URL(response.headers.get("location")!);
  expect(destination.pathname).toBe("/auth/signin");
  expect(destination.searchParams.get("callbackUrl")).toBe(callback);
  expect(response.headers.get("set-cookie")).toBeNull();
});
it.each(["https://evil.test", "//evil.test", "/desktop/connect?challenge=a&challenge=b"])("drops unsafe proof navigation %s", async (callback) => {
  const response = await GET(request("private-proof-token", callback));
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get("location")!).searchParams.has("callbackUrl")).toBe(false);
});
