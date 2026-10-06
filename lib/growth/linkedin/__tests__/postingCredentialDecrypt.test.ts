/**
 * LinkedIn access/refresh tokens are now encrypted at rest
 * (credentialVault.ts). Locks in: a stored token that can't be decrypted
 * — either a real decryption failure, or a legacy row written before
 * encryption was wired up — must never be sent to LinkedIn's API as a
 * raw string. It's treated the same as an expired token (forces
 * reconnect), not a crash and not a silent pass-through of garbage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findDraft: vi.fn(),
  findConnection: vi.fn(),
  updateConnection: vi.fn(),
  createRun: vi.fn(),
  isPostingEnabled: vi.fn(() => true),
  writeGrowthAudit: vi.fn(async () => {}),
  decryptCredential: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    linkedInPostDraft: { findUnique: mocks.findDraft },
    linkedInAccountConnection: { findFirst: mocks.findConnection, update: mocks.updateConnection },
    linkedInPostPublishRun: { create: mocks.createRun },
  },
}));
vi.mock("../oauth", () => ({ isPostingEnabled: mocks.isPostingEnabled }));
vi.mock("../../audit", () => ({ writeGrowthAudit: mocks.writeGrowthAudit }));
vi.mock("../../draftStore", () => ({ transitionStatus: vi.fn(async () => {}) }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: mocks.decryptCredential }));

describe("publishDraft — stored credential decrypt failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPostingEnabled.mockReturnValue(true);
    mocks.findDraft.mockResolvedValue({ id: "draft-1", status: "scheduled", body: "hello", title: "t", imageUrn: null, hashtags: [] });
    mocks.findConnection.mockResolvedValue({
      id: "conn-1",
      accessToken: "not-real-ciphertext",
      organizationUrn: null,
      linkedinUrn: "urn:li:person:abc",
      expiresAt: new Date(Date.now() + 3600_000),
      status: "connected",
    });
    mocks.createRun.mockResolvedValue({ id: "run-1" });
  });

  it("marks the connection expired and returns token_expired instead of posting with an undecryptable token", async () => {
    mocks.decryptCredential.mockImplementation(() => {
      throw new Error("Invalid encrypted payload");
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { publishDraft } = await import("../posting");
    const outcome = await publishDraft({ draftId: "draft-1", triggeredBy: "cron:linkedin-publish" });

    expect(outcome.kind).toBe("token_expired");
    expect(mocks.updateConnection).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: { status: "expired", lastError: expect.stringContaining("decrypted") },
    });
    // The fetch to LinkedIn's API must never happen with a bad token.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts with the decrypted token when decryption succeeds", async () => {
    mocks.decryptCredential.mockReturnValue("real-access-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "urn:li:share:123" },
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { publishDraft } = await import("../posting");
    const outcome = await publishDraft({ draftId: "draft-1", triggeredBy: "cron:linkedin-publish" });

    expect(outcome.kind).toBe("success");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer real-access-token");
  });
});
