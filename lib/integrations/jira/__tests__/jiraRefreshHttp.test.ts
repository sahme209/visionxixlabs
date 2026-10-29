import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {JiraRefreshPersistenceOutcomeUnknown} from '../jiraRefreshPersistence';
import {createJiraRefreshHttp} from '../jiraRefreshHttp';
const actor={organizationId:'org',userId:'owner',canManageConnections:true};
const refresh=vi.fn(),readCurrentActor=vi.fn(),enabled=vi.fn();
const input={connectionId:'connection',revision:'2026-10-28T19:54:37.371Z'};
const handler=()=>createJiraRefreshHttp({enabled,readCurrentActor,refresh});
const request=(body:unknown=input,origin='https://visionxixlabs.com')=>new NextRequest('https://visionxixlabs.com/api/account/integrations/jira/refresh',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
vi.mock('@/lib/api/rateLimiter',()=>({consumeToken:()=>({allowed:true})}));
beforeEach(()=>{vi.resetAllMocks();enabled.mockReturnValue(true);readCurrentActor.mockResolvedValue(actor);refresh.mockResolvedValue({...input,refreshed:true,connectionReadinessVerified:false})});
it('refreshes only an exact administrator-owned connection and returns no readiness claim',async()=>{const response=await handler()(request());expect(response.status).toBe(200);expect(refresh).toHaveBeenCalledWith(actor,input,expect.any(AbortSignal));expect(await response.json()).toEqual({ok:true,data:{...input,refreshed:true,connectionReadinessVerified:false}})});
it('rejects cross-origin requests before reading credentials',async()=>{expect((await handler()(request(input,'https://other.example'))).status).toBe(403);expect(refresh).not.toHaveBeenCalled()});
it('rejects non-admin sessions',async()=>{readCurrentActor.mockResolvedValue({...actor,canManageConnections:false});expect((await handler()(request())).status).toBe(401);expect(refresh).not.toHaveBeenCalled()});
it('rejects caller-selected scope or transport',async()=>{expect((await handler()(request({...input,organizationId:'other'}))).status).toBe(400);expect(refresh).not.toHaveBeenCalled()});
it('never retries or reveals a refresh failure',async()=>{refresh.mockRejectedValue(Error('PRIVATE_TOKEN_SENTINEL'));const response=await handler()(request());expect(response.status).toBe(409);expect(await response.text()).not.toContain('PRIVATE_TOKEN');expect(refresh).toHaveBeenCalledTimes(1)});
it('refuses activation changes before calling refresh',async()=>{enabled.mockReturnValueOnce(true).mockReturnValue(false);expect((await handler()(request())).status).toBe(409);expect(refresh).not.toHaveBeenCalled()});

it('preserves the actual uncertain-rotation state without retry',async()=>{refresh.mockRejectedValue(new JiraRefreshPersistenceOutcomeUnknown());const response=await handler()(request());expect(await response.json()).toEqual({ok:false,error:'jira_refresh_outcome_unknown',retryAllowed:false});expect(refresh).toHaveBeenCalledTimes(1)});
