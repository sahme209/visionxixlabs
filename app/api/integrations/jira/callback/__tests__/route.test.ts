import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks=vi.hoisted(()=>({currentContext:vi.fn(),consume:vi.fn(),matches:vi.fn(),callback:vi.fn(),trustedReturn:vi.fn(),exchange:vi.fn(),findUnique:vi.fn(),create:vi.fn(),encrypt:vi.fn()}));
vi.mock("@/lib/auth/currentContext",()=>({currentContext:mocks.currentContext}));
vi.mock("@/lib/integrations/jira/jiraAuthorization",()=>({consumeJiraAuthorization:mocks.consume}));
vi.mock("@/lib/integrations/trustedCallbackUrl",()=>({matchesTrustedIntegrationCallbackUrl:mocks.matches,trustedIntegrationCallbackUrl:mocks.callback,trustedAxiomUrl:mocks.trustedReturn}));
vi.mock("@/lib/integrations/jira/jiraOAuth",()=>({exchangeJiraAuthorizationCode:mocks.exchange}));
vi.mock("@/lib/security/credentialVault",()=>({encryptScopedCredential:mocks.encrypt}));
vi.mock("@/lib/db",()=>({prisma:{tenantIntegrationConnection:{findUnique:mocks.findUnique,create:mocks.create}}}));
vi.mock("@/lib/security/credentialVault",()=>({encryptScopedCredential:mocks.encrypt}));
const id0=process.env.JIRA_CLIENT_ID,secret0=process.env.JIRA_CLIENT_SECRET;
describe("GET /api/integrations/jira/callback",()=>{
 beforeEach(()=>{vi.clearAllMocks();process.env.JIRA_CLIENT_ID="client";process.env.JIRA_CLIENT_SECRET="secret";mocks.currentContext.mockResolvedValue({isAuthenticated:true,organizationId:"org-a",userId:"user-a",email:"owner@example.com",roles:["owner"]});mocks.consume.mockResolvedValue({ok:true});mocks.matches.mockReturnValue(true);mocks.callback.mockReturnValue("https://visionxixlabs.com/api/integrations/jira/callback");mocks.encrypt.mockReturnValue("ciphertext");mocks.trustedReturn.mockImplementation((p:string)=>new URL(p,"https://visionxixlabs.com"));mocks.exchange.mockResolvedValue({accessToken:"access-token-value",refreshToken:"refresh-token-value",expiresAt:1_798_000_000_000,scopes:["read:jira-work"]});mocks.findUnique.mockResolvedValue(null);mocks.create.mockResolvedValue({id:"connection"});mocks.encrypt.mockReturnValue("ciphertext");});
 afterEach(()=>{if(id0===undefined)delete process.env.JIRA_CLIENT_ID;else process.env.JIRA_CLIENT_ID=id0;if(secret0===undefined)delete process.env.JIRA_CLIENT_SECRET;else process.env.JIRA_CLIENT_SECRET=secret0;});
 it("consumes current owner state and stores exchanged credentials as pending, context-bound tenant data",async()=>{const {GET}=await import("../route");const request=new NextRequest("https://visionxixlabs.com/api/integrations/jira/callback?state="+"s".repeat(43)+"&code=code-value");const response=await GET(request);expect(response.status).toBe(307);expect(response.headers.get("location")).toContain("integration=jira&status=consent_recorded");expect(mocks.consume).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({actor:{organizationId:"org-a",userId:"user-a",canManageConnections:true}}));expect(mocks.exchange).toHaveBeenCalledWith(expect.objectContaining({clientId:"client",clientSecret:"secret",redirectUri:"https://visionxixlabs.com/api/integrations/jira/callback",code:"code-value",signal:request.signal}));expect(mocks.encrypt).toHaveBeenCalledWith(expect.stringContaining('"refreshToken":"refresh-token-value"'),expect.stringContaining("org-a:jira:"));expect(mocks.create).toHaveBeenCalledWith({data:expect.objectContaining({organizationId:"org-a",provider:"jira",status:"pending",externalAccountId:null,consentedByUserId:"user-a",encryptedCredential:"ciphertext"})});});
 it("does not consume another user's callback state",async()=>{mocks.currentContext.mockResolvedValue({isAuthenticated:true,organizationId:"org-b",userId:"user-b",roles:["owner"]});mocks.consume.mockResolvedValue({ok:false});const {GET}=await import("../route");await GET(new NextRequest("https://visionxixlabs.com/api/integrations/jira/callback?state="+"s".repeat(43)+"&code=code-value"));expect(mocks.exchange).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();});
 it("does not consume one-time state when a proxy alias reaches the callback",async()=>{const {GET}=await import("../route");await GET(new NextRequest("https://untrusted.example/api/integrations/jira/callback?state="+"s".repeat(43)+"&code=code-value"));expect(mocks.consume).not.toHaveBeenCalled();expect(mocks.exchange).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();});
 it("rejects malformed or oversized state before database lookup",async()=>{const {GET}=await import("../route");await GET(new NextRequest("https://visionxixlabs.com/api/integrations/jira/callback?state="+"!".repeat(2048)+"&code=code-value"));expect(mocks.consume).not.toHaveBeenCalled();expect(mocks.exchange).not.toHaveBeenCalled();});
 it("does not overwrite an existing tenant Jira connection",async()=>{mocks.findUnique.mockResolvedValue({id:"existing"});const {GET}=await import("../route");await GET(new NextRequest("https://visionxixlabs.com/api/integrations/jira/callback?state="+"s".repeat(43)+"&code=code-value"));expect(mocks.exchange).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();});
 it("does not exchange provider code if the trusted callback origin changed",async()=>{mocks.matches.mockReturnValue(false);const {GET}=await import("../route");await GET(new NextRequest("https://visionxixlabs.com/api/integrations/jira/callback?state="+"s".repeat(43)+"&code=code-value"));expect(mocks.exchange).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();});
 it.each([
  {isAuthenticated:true,organizationId:"org-a",userId:"user-a",roles:["read_only"]},
  {isAuthenticated:true,organizationId:"org-b",userId:"user-a",roles:["owner"]},
  {isAuthenticated:true,organizationId:"org-a",userId:"user-b",roles:["owner"]},
  {isAuthenticated:false,roles:[]},
 ])("refuses credential storage if callback authority changes during token exchange: %j",async latest=>{
  mocks.exchange.mockImplementationOnce(async()=>{
   mocks.currentContext.mockResolvedValue(latest);
   return {accessToken:"access-token-value",refreshToken:"refresh-token-value",expiresAt:1_798_000_000_000,scopes:["read:jira-work"]};
  });
  const {GET}=await import("../route");
  const response=await GET(new NextRequest("https://visionxixlabs.com/api/integrations/jira/callback?state="+"s".repeat(43)+"&code=code-value"));
  expect(response.headers.get("location")).toContain("status=authorization_required");
  expect(mocks.encrypt).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
 });
});
