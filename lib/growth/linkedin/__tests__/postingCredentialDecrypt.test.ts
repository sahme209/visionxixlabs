/**
 * LinkedIn access/refresh tokens are now encrypted at rest
 * (credentialVault.ts). Locks in: a stored token that can't be decrypted
 * — either a real decryption failure, or a legacy row written before
 * encryption was wired up — must never be sent to LinkedIn's API as a
 * raw string. It's treated the same as an expired token (forces
 * reconnect), not a crash and not a silent pass-through of garbage.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findDraft: vi.fn(),
  findConnection: vi.fn(),
  updateConnection: vi.fn(),
  updateDraft:vi.fn(),
  createRun: vi.fn(),
  isPostingEnabled: vi.fn(() => true),
  writeGrowthAudit: vi.fn(async () => {}),
  decryptCredential: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    linkedInPostDraft: { findUnique: mocks.findDraft,updateMany:mocks.updateDraft },
    linkedInAccountConnection: { findUnique: mocks.findConnection, updateMany: mocks.updateConnection },
    linkedInPostPublishRun: { create: mocks.createRun },
  },
}));
vi.mock("../oauth", () => ({ isPostingEnabled: mocks.isPostingEnabled }));
vi.mock("../../audit", () => ({ writeGrowthAudit: mocks.writeGrowthAudit }));
vi.mock("../../draftStore", () => ({ transitionStatus: vi.fn(async () => {}) }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: mocks.decryptCredential }));

import {preparePlatformLinkedInPost} from '../platformPostingPlan';
import {bindPlatformExecution} from '@/lib/governance/platform/effectExecution';
let draftSnapshot:{id:string;title:string;hook:string;body:string;cta:null;imageUrn:null;hashtags:string[];status:string;scheduledFor:null;updatedAt:Date};
let connectionSnapshot:{id:string;organizationUrn:null;linkedinUrn:string;scopes:string;expiresAt:Date;status:string;updatedAt:Date};
function grant(){const effect=preparePlatformLinkedInPost(draftSnapshot,connectionSnapshot,'202605',Date.now()).effect;return bindPlatformExecution({actorUserId:'actual-requester',claimNextEffect:async()=>({effect,proof:{}}),beforeEffectSend:async()=>{},observeEffect:async()=>{}},'fixture-action')}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
describe("publishDraft — stored credential decrypt failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPostingEnabled.mockReturnValue(true);
    vi.stubEnv('LINKEDIN_REST_VERSION','202605');
    draftSnapshot={id:'draft-1',status:'approved',hook:'Hook',body:'hello',title:'t',cta:null,imageUrn:null,hashtags:[],scheduledFor:null,updatedAt:new Date(Date.now()-1000)};
    connectionSnapshot={id:'conn-1',organizationUrn:null,linkedinUrn:'urn:li:person:abc',scopes:'w_member_social',expiresAt:new Date(Date.now()+3600000),status:'connected',updatedAt:new Date(Date.now()-1000)};
    mocks.findDraft.mockResolvedValue(draftSnapshot);
    mocks.findConnection.mockImplementation(async args=>args.select?.accessToken?{accessToken:'not-real-ciphertext',updatedAt:connectionSnapshot.updatedAt}:connectionSnapshot);
    mocks.updateDraft.mockResolvedValue({count:1});mocks.updateConnection.mockResolvedValue({count:1});
    mocks.createRun.mockResolvedValue({ id: "run-1" });
  });

  it("marks the connection expired and returns token_expired instead of posting with an undecryptable token", async () => {
    mocks.decryptCredential.mockImplementation(() => {
      throw new Error("Invalid encrypted payload");
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { publishDraft } = await import("../posting");
    const outcome = await publishDraft({ draftId: "draft-1", triggeredBy: "operator-hint",connectionId:"conn-1",platformExecution:grant() });

    expect(outcome.kind).toBe("token_expired");
    expect(mocks.updateConnection).toHaveBeenCalledWith({
      where: { id: "conn-1",updatedAt:connectionSnapshot.updatedAt,status:"connected" },
      data: { status: "expired", lastError: expect.stringContaining("decrypted") },
    });
    // The fetch to LinkedIn's API must never happen with a bad token.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts with the decrypted token when decryption succeeds", async () => {
    mocks.decryptCredential.mockReturnValue("real-access-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,status:201,
      headers: { get: () => "urn:li:share:123" },
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { publishDraft } = await import("../posting");
    const outcome = await publishDraft({ draftId: "draft-1", triggeredBy: "operator-hint",connectionId:"conn-1",platformExecution:grant() });

    expect(outcome.kind).toBe("success");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer real-access-token");
  });
});
