import {expect,it,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({authority:vi.fn(),ports:null as any,scope:null as any,methods:{propose:vi.fn(),readRevision:vi.fn(),approve:vi.fn(),activate:vi.fn(),revoke:vi.fn(),readAuthority:vi.fn()}}));
vi.mock('../requestAuthority',()=>({createGovernanceRequestAuthority:()=>m.authority}));
vi.mock('../executionPolicyStore',()=>({createGovernanceExecutionPolicyStore:(_repo:any,ports:any)=>{m.ports=ports;return m.methods;}}));
import {createGovernanceExecutionPolicyRequestService} from '../executionPolicyRequestService';
const scope={organizationId:'org',actorUserId:'executor',sessionId:'executor-session'};
beforeEach(()=>{vi.clearAllMocks();m.authority.mockResolvedValue(undefined);});
function fixture(){
 let memberRole='admin',sessionLive=true;
 const query=vi.fn(async(strings:TemplateStringsArray,...values:unknown[])=>strings.join('').includes('OrgMembership')?[{organizationId:'org',userId:values[1],role:memberRole,acceptedAt:new Date()}]:[{id:values[0],organizationId:'org',userId:values[2],live:sessionLive}]);
 const request=new NextRequest('https://app.test/policy'),service=createGovernanceExecutionPolicyRequestService(request,{} as never,scope,()=>true);
 return{service,tx:{$queryRaw:query},query,changeRole(){memberRole='read_only';},revokeSession(){sessionLive=false;}};
}
it('uses paired authority for own decisions and current membership/session for recorded reviewers',async()=>{
 const f=fixture();await m.ports.assertCurrent(f.tx,scope,{userId:'executor',sessionId:'executor-session'},'policy_admin');
 expect(m.authority).toHaveBeenCalledWith(f.tx,scope,'policy_admin');
 await m.ports.assertCurrent(f.tx,scope,{userId:'reviewer',sessionId:'reviewer-session'},'approver');
 expect(f.query).toHaveBeenCalledTimes(2);expect(m.authority).toHaveBeenLastCalledWith(f.tx,scope,'reader');
});
it('refuses changed caller, session, recorded role and revoked recorded session',async()=>{
 const f=fixture();await expect(m.ports.assertCurrent(f.tx,{...scope,actorUserId:'other'},{userId:'reviewer',sessionId:'reviewer-session'},'approver')).rejects.toThrow('identity_changed');
 await expect(m.ports.assertCurrent(f.tx,scope,{userId:'executor',sessionId:'other'},'reader')).rejects.toThrow('session_changed');
 f.changeRole();await expect(m.ports.assertCurrent(f.tx,scope,{userId:'reviewer',sessionId:'reviewer-session'},'approver')).rejects.toThrow('principal_unavailable');
 const g=fixture();g.revokeSession();await expect(m.ports.assertCurrent(g.tx,scope,{userId:'reviewer',sessionId:'reviewer-session'},'approver')).rejects.toThrow('session_unavailable');
});
it('keeps disabled configuration unavailable and forwards only the bound request scope',async()=>{
 const f=fixture();f.service.propose({level:4},'nonce');expect(m.methods.propose).toHaveBeenCalledWith(scope,{level:4},'nonce');
 const disabled=createGovernanceExecutionPolicyRequestService(new NextRequest('https://app.test/policy'),{} as never,scope,()=>false);
 expect(()=>disabled.activate('revision',null,null,'nonce')).toThrow('intelligence_unavailable');expect(m.methods.activate).not.toHaveBeenCalled();
});
