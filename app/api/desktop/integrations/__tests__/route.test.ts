import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  getGithubConfig: vi.fn(),
  isGithubAppInstallationReady: vi.fn(),
  trustedIntegrationCallbackUrl: vi.fn(),
  connectorFindMany: vi.fn(),
  azureList: vi.fn(),
  azureCanonical: vi.fn(),
  awsList: vi.fn(),
  connectionFindMany: vi.fn(),
  installationFindFirst: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolveRequestDesktopSession }));
vi.mock("@/lib/connectors/github/githubConfig", () => ({ getGithubConfig: mocks.getGithubConfig, isGithubAppInstallationReady: mocks.isGithubAppInstallationReady }));
vi.mock("@/lib/integrations/trustedCallbackUrl", () => ({ trustedIntegrationCallbackUrl: mocks.trustedIntegrationCallbackUrl }));
vi.mock("@/lib/cloud/aws/enrollment/runtime", () => ({awsEnrollment:{list:mocks.awsList}}));
vi.mock('@/lib/cloud/azure/guided/runtime',()=>({readAzureGuidedCanonical:mocks.azureCanonical}));
vi.mock("@/lib/cloud/azure/enrollment/runtime", () => ({ azureEnrollment: { list: mocks.azureList } }));
vi.mock("@/lib/db", () => ({
  prisma: {
    connectorSetupSession: { findMany: mocks.connectorFindMany },
    tenantIntegrationConnection: { findMany: mocks.connectionFindMany },
    gitHubInstallation: { findFirst: mocks.installationFindFirst },
  },
}));

describe("GET /api/desktop/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue({ userId: "user-1", organizationId: "org-1" });
    mocks.connectorFindMany.mockResolvedValue([]);
    mocks.connectionFindMany.mockResolvedValue([]);
    mocks.installationFindFirst.mockResolvedValue(null);
    mocks.getGithubConfig.mockResolvedValue({ appSlug: "axiom" });
    mocks.isGithubAppInstallationReady.mockReturnValue(true);
    mocks.trustedIntegrationCallbackUrl.mockImplementation((path: string) => `https://visionxixlabs.com${path}`);
    process.env.SLACK_CLIENT_ID = "slack-id";
    process.env.SLACK_CLIENT_SECRET = "slack-secret";
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_TENANT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.LINEAR_CLIENT_ID;
    delete process.env.LINEAR_CLIENT_SECRET;
  });

  afterEach(() => {
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
  });

  it("reports connection readiness without exposing provider credentials", async () => {
    const { GET } = await import("../route");
    const response = await GET(new NextRequest("https://visionxixlabs.com/api/desktop/integrations"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.configuration).toEqual({ github: true, slack: true, teams: false, linear: false });
    expect(JSON.stringify(body)).not.toContain("slack-secret");
    expect(body.data.collaboration).toEqual([
      { provider: "slack", status: "not_connected", lastValidatedAt: null },
      { provider: "teams", status: "not_connected", lastValidatedAt: null },
      { provider: "linear", status: "not_connected", lastValidatedAt: null },
    ]);
  });
});

it('returns only opaque session-bound consent receipts and refuses late identity changes',async()=>{
 mocks.resolveRequestDesktopSession.mockResolvedValue({id:'session',credentialKind:'desktop_session',userId:'user',organizationId:'org'});mocks.connectorFindMany.mockResolvedValue([]);mocks.installationFindFirst.mockResolvedValue(null);mocks.getGithubConfig.mockResolvedValue({});mocks.connectionFindMany.mockResolvedValue([{id:'private-row',provider:'teams',status:'pending',lastValidatedAt:null,revokedAt:null,consentedByUserId:'user',consentedAt:new Date('2026-10-26'),encryptedCredential:'private-random-cipher'}]);const {GET}=await import('../route');const a=await GET(new NextRequest('https://owned.test/api/desktop/integrations'));const body=await a.json();expect(body.data.collaboration.find((x:any)=>x.provider==='teams').recoveryReceipt).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(body)).not.toMatch(/private-row|private-random-cipher/);expect(a.headers.get('cache-control')).toContain('no-store');mocks.resolveRequestDesktopSession.mockResolvedValueOnce({id:'session',credentialKind:'desktop_session',userId:'user',organizationId:'org'}).mockResolvedValueOnce({id:'other',credentialKind:'desktop_session',userId:'other',organizationId:'org'});expect((await GET(new NextRequest('https://owned.test/api/desktop/integrations'))).status).toBe(401);
});

it('changes receipts only for consent or session, and never offers revoked or other-consenter recovery',async()=>{
 const actor={id:'session',credentialKind:'desktop_session',userId:'user',organizationId:'org'};mocks.resolveRequestDesktopSession.mockResolvedValue(actor);mocks.connectorFindMany.mockResolvedValue([]);mocks.installationFindFirst.mockResolvedValue(null);mocks.getGithubConfig.mockResolvedValue({});const row={id:'private-row',provider:'teams',status:'pending',lastValidatedAt:null,revokedAt:null as Date|null,consentedByUserId:'user',consentedAt:new Date('2026-10-26'),updatedAt:new Date('2026-10-26')};mocks.connectionFindMany.mockImplementation(async()=>[row]);const {GET}=await import('../route');const read=async()=>{const b=await(await GET(new NextRequest('https://owned.test/api/desktop/integrations'))).json();return b.data.collaboration.find((x:any)=>x.provider==='teams')};const first=(await read()).recoveryReceipt;row.updatedAt=new Date('2026-10-27');expect((await read()).recoveryReceipt).toBe(first);row.consentedAt=new Date('2026-10-28');expect((await read()).recoveryReceipt).not.toBe(first);mocks.resolveRequestDesktopSession.mockResolvedValue({...actor,id:'other-session'});const second=(await read()).recoveryReceipt;expect(second).not.toBe(first);row.consentedByUserId='other';expect((await read()).recoveryReceipt).toBeUndefined();row.consentedByUserId='user';row.revokedAt=new Date();expect((await read()).recoveryReceipt).toBeUndefined();
});


describe('canonical Azure read-only summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue({id:'session',credentialKind:'desktop_session',userId:'user',organizationId:'org'});
    mocks.connectorFindMany.mockResolvedValue([{provider:'azure',status:'connected',lastTransitionAt:new Date('2026-10-20')}]);
    mocks.connectionFindMany.mockResolvedValue([]);
    mocks.installationFindFirst.mockResolvedValue(null);
    mocks.getGithubConfig.mockResolvedValue({});
    mocks.azureList.mockResolvedValue({accounts:[]});mocks.azureCanonical.mockResolvedValue({id:'valid'});
  });
  const read = async () => {const {GET}=await import('../route');return (await (await GET(new NextRequest('https://owned.test/api/desktop/integrations'))).json()).data.cloud.find((x:any)=>x.provider==='azure');};
  it('uses canonical enrolled connection without promoting execution or exposing identifiers',async()=>{
    mocks.azureList.mockResolvedValue({accounts:[{connected:true,lastValidatedAt:'2026-10-26T12:00:00.000Z',id:'private-account',subscriptionId:'private-subscription',enabled:false,agentScanAvailable:false}]});
    expect(await read()).toEqual({provider:'azure',status:'read_only_connected',lastTransitionAt:'2026-10-26T12:00:00.000Z'});
    expect(mocks.azureList).toHaveBeenCalledWith({organizationId:'org',userId:'user',sessionId:'session'});
  });
  it('never reports legacy success for an empty or revoked canonical connection',async()=>{
    expect((await read()).status).toBe('not_connected');
    mocks.azureList.mockResolvedValue({accounts:[{connected:false,lastValidatedAt:'2026-10-26T12:00:00.000Z'}]});
    expect((await read()).status).toBe('not_connected');
  });
  it('fails closed on canonical read failure rather than falling back to legacy connected',async()=>{
    mocks.azureList.mockRejectedValue(new Error('private failure'));
    expect(await read()).toEqual({provider:'azure',status:'unavailable',lastTransitionAt:null});
  });
  it('does not use paired enrollment authority for an API key',async()=>{
    mocks.resolveRequestDesktopSession.mockResolvedValue({id:'key',credentialKind:'api_key',userId:'user',organizationId:'org'});
    expect((await read()).status).toBe('unavailable');expect(mocks.azureList).not.toHaveBeenCalled();
  });
});

describe('canonical AWS read-only summary',()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.resolveRequestDesktopSession.mockResolvedValue({id:'session',credentialKind:'desktop_session',organizationId:'org',userId:'user'});mocks.connectorFindMany.mockResolvedValue([{provider:'aws',status:'connected',lastTransitionAt:new Date('2026-10-20')}]);mocks.connectionFindMany.mockResolvedValue([]);mocks.installationFindFirst.mockResolvedValue(null);mocks.getGithubConfig.mockResolvedValue({});mocks.awsList.mockResolvedValue({accounts:[]});mocks.azureList.mockResolvedValue({accounts:[]})});
 const read=async()=>{const {GET}=await import('../route');const response=await GET(new NextRequest('https://visionxixlabs.com/api/desktop/integrations'));return(await response.json()).data.cloud.find((x:any)=>x.provider==='aws')};
 it('reports canonical read-only enrollment regardless of missing legacy setup and exposes no account data',async()=>{mocks.connectorFindMany.mockResolvedValue([]);mocks.awsList.mockResolvedValue({accounts:[{connected:true,lastValidatedAt:'2026-10-27T01:00:00.000Z',accountId:'private-account',regions:['private'],agentScanAvailable:false,enabled:false}]});expect(await read()).toEqual({provider:'aws',status:'read_only_connected',lastTransitionAt:'2026-10-27T01:00:00.000Z'});expect(mocks.awsList).toHaveBeenCalledWith('org')});
 it('never falls back to legacy success for empty/revoked canonical account or failure',async()=>{expect((await read()).status).toBe('not_connected');mocks.awsList.mockResolvedValue({accounts:[{connected:false,lastValidatedAt:'2026-10-27T01:00:00.000Z'}]});expect((await read()).status).toBe('not_connected');mocks.awsList.mockRejectedValue(new Error('private'));expect(await read()).toEqual({provider:'aws',status:'unavailable',lastTransitionAt:null})});
 it('does not use paired canonical storage for API key summary',async()=>{mocks.resolveRequestDesktopSession.mockResolvedValue({id:'key',credentialKind:'api_key',organizationId:'org',userId:'user'});expect((await read()).status).toBe('unavailable');expect(mocks.awsList).not.toHaveBeenCalled()});
});

it('Azure summary refuses expired/revoked delegated credential despite old enrollment connected projection',async()=>{mocks.resolveRequestDesktopSession.mockResolvedValue({id:'session',credentialKind:'desktop_session',userId:'user',organizationId:'org'});mocks.connectorFindMany.mockResolvedValue([]);mocks.connectionFindMany.mockResolvedValue([]);mocks.installationFindFirst.mockResolvedValue(null);mocks.getGithubConfig.mockResolvedValue({});mocks.azureList.mockResolvedValue({accounts:[{id:'delegated',connected:true,lastValidatedAt:'2026-10-27T12:00:00.000Z'}]});mocks.azureCanonical.mockResolvedValue(null);const{GET}=await import('../route');const b=await(await GET(new NextRequest('https://owned.test/api/desktop/integrations'))).json();expect(b.data.cloud.find((x:any)=>x.provider==='azure').status).toBe('not_connected')});
