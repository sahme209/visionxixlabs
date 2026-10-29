import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {buildJiraConsentUrl,exchangeJiraAuthorizationCode,readJiraAccessibleSites,selectJiraSite} from "../jiraOAuth";
const config={clientId:"axiom-client",clientSecret:"private-app-secret",redirectUri:"https://axiom.example/api/integrations/jira/callback"};
const signal=()=>new AbortController().signal;
const site=(id="01234567-89ab-4cde-8fab-0123456789ab")=>({id,name:"Axiom testing",url:"https://visionxixlabs.atlassian.net",scopes:["read:jira-work"]});
const mockFetch=vi.fn();
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal("fetch",mockFetch)});afterEach(()=>vi.unstubAllGlobals());
describe("shared Axiom Jira OAuth adapter",()=>{
 it("uses the provider consent endpoint and only explicit initial read scopes",()=>{
  const url=new URL(buildJiraConsentUrl({...config,state:"a".repeat(43)}));
  expect(url.origin+url.pathname).toBe("https://auth.atlassian.com/authorize");
  expect(url.searchParams.get("scope")).toBe("read:jira-work offline_access");
  expect(url.searchParams.get("state")).toBe("a".repeat(43));expect(url.searchParams.get("audience")).toBe("api.atlassian.com");
  expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);expect(url.searchParams.get("prompt")).toBe("consent");
  expect(url.toString()).not.toContain(config.clientSecret);
 });
 it("rejects weak state and invalid callback configuration",()=>{
  expect(()=>buildJiraConsentUrl({...config,state:"weak"})).toThrow();
  for(const redirectUri of ["http://axiom.example/api/integrations/jira/callback","https://user:password@axiom.example/api/integrations/jira/callback",config.redirectUri+"#secret",config.redirectUri+"?other=1"])
   expect(()=>buildJiraConsentUrl({...config,redirectUri,state:"a".repeat(43)})).toThrow();
 });
 it("exchanges once at a fixed endpoint and keeps credentials server-side",async()=>{
  mockFetch.mockResolvedValue(new Response(JSON.stringify({access_token:"private-access",refresh_token:"private-refresh",expires_in:3600,scope:"read:jira-work offline_access"})));
  const result=await exchangeJiraAuthorizationCode({...config,code:"authorized-code",signal:signal(),now:()=>1000});
  expect(result).toEqual({accessToken:"private-access",refreshToken:"private-refresh",expiresAt:3601000,scopes:["read:jira-work","offline_access"]});
  expect(mockFetch).toHaveBeenCalledTimes(1);const [url,options]=mockFetch.mock.calls[0];expect(url).toBe("https://auth.atlassian.com/oauth/token");
  expect(options).toMatchObject({method:"POST",redirect:"error",credentials:"omit",cache:"no-store"});
  expect(JSON.parse(options.body)).toEqual({grant_type:"authorization_code",client_id:config.clientId,client_secret:config.clientSecret,code:"authorized-code",redirect_uri:config.redirectUri});
 });
 it("does not infer a refresh token or required read grant",async()=>{
  mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({access_token:"private-access",expires_in:3600,scope:"read:jira-work"})));
  expect((await exchangeJiraAuthorizationCode({...config,code:"code",signal:signal(),now:()=>1000})).refreshToken).toBeNull();
  mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({access_token:"private-access",expires_in:3600,scope:"write:jira-work"})));
  await expect(exchangeJiraAuthorizationCode({...config,code:"code",signal:signal()})).rejects.toThrow("jira_authorization_unavailable");
 });
 it.each([0,-1,Infinity,"3600",86401])("refuses invalid token lifetime %s",async(expires_in)=>{
  mockFetch.mockResolvedValue(new Response(JSON.stringify({access_token:"private-access",expires_in,scope:"read:jira-work"})));
  await expect(exchangeJiraAuthorizationCode({...config,code:"code",signal:signal()})).rejects.toThrow("jira_authorization_unavailable");
 });
 it("reads site identities with no automatic first-site selection",async()=>{
  const second={...site("11234567-89ab-4cde-8fab-0123456789ab"),url:"https://second.atlassian.net",name:"Second"};
  mockFetch.mockResolvedValue(new Response(JSON.stringify([site(),second])));
  const sites=await readJiraAccessibleSites({accessToken:"private-access",signal:signal()});expect(sites).toHaveLength(2);
  expect(()=>selectJiraSite(sites,"")).toThrow();expect(selectJiraSite(sites,second.id)).toEqual(second);
  expect(mockFetch).toHaveBeenCalledWith("https://api.atlassian.com/oauth/token/accessible-resources",expect.objectContaining({method:"GET",redirect:"error",headers:expect.objectContaining({authorization:"Bearer private-access"})}));
 });
 it("omits non-Jira resources without treating them as Jira grants",async()=>{
  mockFetch.mockResolvedValue(new Response(JSON.stringify([site(),{...site("11234567-89ab-4cde-8fab-0123456789ab"),scopes:["read:confluence-content.all"]}])));
  expect(await readJiraAccessibleSites({accessToken:"private-access",signal:signal()})).toEqual([site()]);
 });
 it("refuses duplicate, unsafe or oversized site lists",async()=>{
  for(const body of [[site(),site()],[{...site(),url:"http://visionxixlabs.atlassian.net"}],Array.from({length:101},()=>site())]){
   mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(body)));
   await expect(readJiraAccessibleSites({accessToken:"private-access",signal:signal()})).rejects.toThrow("jira_authorization_unavailable");
  }
 });
 it("cancels rejected provider bodies and never reflects their content",async()=>{
  const canceled=vi.fn();mockFetch.mockResolvedValue(new Response(new ReadableStream({cancel:canceled}),{status:403}));
  await expect(exchangeJiraAuthorizationCode({...config,code:"code",signal:signal()})).rejects.toThrow(/^jira_authorization_unavailable$/);expect(canceled).toHaveBeenCalled();expect(mockFetch).toHaveBeenCalledTimes(1);
 });
 it("bounds response bytes and aborts a stalled transport",async()=>{
  mockFetch.mockResolvedValueOnce(new Response("x".repeat(256*1024+1)));
  await expect(readJiraAccessibleSites({accessToken:"private-access",signal:signal()})).rejects.toThrow("jira_authorization_unavailable");
  mockFetch.mockImplementation(()=>new Promise(()=>undefined));const controller=new AbortController();const result=readJiraAccessibleSites({accessToken:"private-access",signal:controller.signal});
  await vi.waitFor(()=>expect(mockFetch).toHaveBeenCalledTimes(2));controller.abort();await expect(result).rejects.toThrow("jira_authorization_unavailable");
 });
 it("refuses unrequested token scopes rather than silently accepting write access",async()=>{
  mockFetch.mockResolvedValue(new Response(JSON.stringify({access_token:"private-access",expires_in:3600,scope:"read:jira-work write:jira-work"})));
  await expect(exchangeJiraAuthorizationCode({...config,code:"code",signal:signal()})).rejects.toThrow("jira_authorization_unavailable");
 });
 it("discards a late response after a stalled fetch was canceled",async()=>{
  let finish:(response:Response)=>void=()=>undefined;mockFetch.mockImplementation(()=>new Promise<Response>(resolve=>{finish=resolve}));
  const controller=new AbortController();const result=readJiraAccessibleSites({accessToken:"private-access",signal:controller.signal});
  await vi.waitFor(()=>expect(mockFetch).toHaveBeenCalled());controller.abort();await expect(result).rejects.toThrow("jira_authorization_unavailable");
  const canceled=vi.fn();finish(new Response(new ReadableStream({cancel:canceled})));await vi.waitFor(()=>expect(canceled).toHaveBeenCalledTimes(1));
 });
 it("returns a detached immutable explicit site selection",()=>{
  const resources=[site()];const selected=selectJiraSite(resources,resources[0].id);resources[0].name="changed";resources[0].scopes.push("write:jira-work");
  expect(selected.name).toBe("Axiom testing");expect(selected.scopes).toEqual(["read:jira-work"]);expect(Object.isFrozen(selected)).toBe(true);expect(Object.isFrozen(selected.scopes)).toBe(true);
 });

});

it('requests ticket write scope only through the explicit upgrade purpose',()=>{
 const url=new URL(buildJiraConsentUrl({clientId:'client',redirectUri:'https://visionxixlabs.com/api/integrations/jira/callback',state:'a'.repeat(86),purpose:'ticket_write_upgrade'}));
 expect(url.searchParams.get('scope')).toBe('read:jira-work write:jira-work offline_access');
});
it('accepts a write upgrade only when explicitly requested and keeps unrelated grants refused',async()=>{
 mockFetch.mockResolvedValue(Response.json({access_token:'private-access',refresh_token:'private-refresh',expires_in:3600,scope:'read:jira-work write:jira-work offline_access'}));
 await expect(exchangeJiraAuthorizationCode({...config,code:'code',signal:signal(),purpose:'ticket_write_upgrade',now:()=>1000})).resolves.toMatchObject({scopes:['read:jira-work','write:jira-work','offline_access']});
 mockFetch.mockResolvedValue(Response.json({access_token:'private-access',expires_in:3600,scope:'read:jira-work write:jira-work manage:jira-project'}));
 await expect(exchangeJiraAuthorizationCode({...config,code:'code',signal:signal(),purpose:'ticket_write_upgrade'})).rejects.toThrow();
});
