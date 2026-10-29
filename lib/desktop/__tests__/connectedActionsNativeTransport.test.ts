import {afterEach,expect,it,vi} from 'vitest';
import {connectedActionsRequest} from '../../../desktop/src/lib/connectedActionsTransport';
const config={apiBase:'https://axiom.example',sessionToken:'axm.desk.synthetic'};
function context(){let revision=1;return {getConfig:()=>config,getRevision:()=>revision,subscribe:()=>()=>{},change:()=>revision++}}
const data={provider:'linear',enabled:false,canRequest:false,canApprove:false,actions:[],truncated:false};
afterEach(()=>vi.unstubAllGlobals());
it('uses the fixed paired route without cookies or provider credentials',async()=>{const f=vi.fn().mockResolvedValue(Response.json({ok:true,data}));vi.stubGlobal('fetch',f);expect(await connectedActionsRequest(context(),'linear')).toEqual({ok:true,data});expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][0]).toBe('https://axiom.example/api/desktop/integrations/linear/actions');expect(f.mock.calls[0][1]).toMatchObject({credentials:'omit',redirect:'error',headers:{Authorization:'Bearer axm.desk.synthetic'}})});
it('rejects a response from a previous workspace',async()=>{const c=context();vi.stubGlobal('fetch',vi.fn(async()=>{c.change();return Response.json({ok:true,data})}));expect(await connectedActionsRequest(c,'linear')).toMatchObject({ok:false})});
it('rejects provider substitution and oversized responses',async()=>{for(const response of [Response.json({ok:true,data:{...data,provider:'teams'}}),new Response('x',{headers:{'content-length':'524289'}})]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));expect(await connectedActionsRequest(context(),'linear')).toMatchObject({ok:false})}});
it('does not dispatch caller-injected authority',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);expect(await connectedActionsRequest(context(),'linear',{action:'request',kind:'linear_issue_create',intentId:'11111111-1111-4111-8111-111111111111',teamId:'22222222-2222-4222-8222-222222222222',title:'Test',token:'injected'} as never)).toMatchObject({ok:false,outcomeUnconfirmed:false});expect(f).not.toHaveBeenCalled()});
it('retains uncertainty after a lost mutation acknowledgement and never retries',async()=>{const f=vi.fn().mockRejectedValue(Error('offline'));vi.stubGlobal('fetch',f);expect(await connectedActionsRequest(context(),'linear',{action:'execute',id:'connected_action_'+'a'.repeat(64),expectedVersion:1})).toMatchObject({ok:false,outcomeUnconfirmed:true});expect(f).toHaveBeenCalledTimes(1)});
it('uses an allowlisted recovery message for missing action permissions',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:false,error:'connected_action_permission_required'},{status:403})));expect(await connectedActionsRequest(context(),'teams')).toMatchObject({ok:false,errorCode:'connected_action_permission_required',outcomeUnconfirmed:false})});

it('refuses credential-bearing, insecure or path-prefixed API bases before transmission',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);for(const apiBase of ['https://user:secret@axiom.example','http://public.example','https://axiom.example/other','https://axiom.example/?token=x']){const c=context(),bad={...config,apiBase};expect(await connectedActionsRequest({...c,getConfig:()=>bad},'linear')).toMatchObject({ok:false,outcomeUnconfirmed:false})}expect(f).not.toHaveBeenCalled()});

// Retrying a draft is a ledger save with the original UUID/content, never a
// provider execution or an automatically generated replacement request.
it('explicit draft retry preserves the exact request and never retries execution',async()=>{
 const {DesktopClient}=await import('../../../desktop/src/lib/desktopClient');
 const client=new DesktopClient({...config}),f=vi.fn().mockRejectedValue(Error('offline'));
 vi.stubGlobal('fetch',f);
 const draft={action:'request' as const,kind:'linear_issue_create' as const,intentId:'11111111-1111-4111-8111-111111111111',teamId:'22222222-2222-4222-8222-222222222222',title:'Exact draft',description:'Original content'};
 await client.mutateConnectedAction('linear',draft);expect(f).toHaveBeenCalledTimes(1);
 await client.retrySavingConnectedActionDraft('linear');expect(f).toHaveBeenCalledTimes(2);
 expect(f.mock.calls.map(c=>JSON.parse(c[1].body))).toEqual([draft,draft]);
 const executing=new DesktopClient({...config});
 await executing.mutateConnectedAction('linear',{action:'execute',id:'connected_action_'+'a'.repeat(64),expectedVersion:1});
 const count=f.mock.calls.length;expect(await executing.retrySavingConnectedActionDraft('linear')).toMatchObject({ok:false});expect(f).toHaveBeenCalledTimes(count);
});

it('shows the specific Teams license recovery without implying a saved-action failure',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:false,error:'connected_action_teams_license_required'},{status:409})));
 const result=await connectedActionsRequest(context(),'teams',undefined,{targets:'1'});
 expect(result).toMatchObject({ok:false,errorCode:'connected_action_teams_license_required',outcomeUnconfirmed:false});
 if(!result.ok){expect(result.error).toContain('licensed work account');expect(result.error).not.toContain('outcome could not be confirmed')}
});
it('loads only the requested saved Bot task history and explains an older service',async()=>{
 const taskId='bot_'+'a'.repeat(64),f=vi.fn().mockResolvedValue(Response.json({ok:true,data}));vi.stubGlobal('fetch',f);expect((await connectedActionsRequest(context(),'linear',undefined,{taskId})).ok).toBe(true);expect(f.mock.calls[0][0]).toContain('?taskId='+taskId);
 f.mockResolvedValue(Response.json({ok:false,error:'invalid_connected_action'},{status:400}));expect(await connectedActionsRequest(context(),'linear',undefined,{taskId})).toMatchObject({ok:false,errorCode:'bot_task_linking_unavailable',outcomeUnconfirmed:false});
});
it('does not retain a known rolled-back stale-task draft as an unknown provider write',async()=>{
 const {DesktopClient}=await import('../../../desktop/src/lib/desktopClient'),client=new DesktopClient({...config}),sourceTask={taskId:'bot_'+'a'.repeat(64),expectedVersion:2};
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:false,error:'bot_action_task_changed'},{status:409})));
 expect(await client.mutateConnectedAction('linear',{action:'request',kind:'linear_issue_create',intentId:'11111111-1111-4111-8111-111111111111',teamId:'22222222-2222-4222-8222-222222222222',title:'Exact',sourceTask})).toMatchObject({ok:false,errorCode:'bot_action_task_changed',outcomeUnconfirmed:false});expect(client.connectedActionPending('linear')).toBeUndefined();
});
