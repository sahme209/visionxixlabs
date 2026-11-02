import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({resolve:vi.fn(),commercial:vi.fn(),store:vi.fn()}));
vi.mock('../resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:mocks.resolve}));
vi.mock('../desktopCommercialAccess',()=>({readDesktopCommercialAccess:mocks.commercial}));
vi.mock('@/lib/axiom/agentRuntime/agentActionExecutionStore',()=>({createAgentActionExecutionStore:mocks.store}));
import {createAgentActionExecutionRequestService} from '../agentActionExecutionRequestService';
const scope={organizationId:'org',actorUserId:'requester',sessionId:'session'};
const request=new Request('https://fixture.test') as any;
beforeEach(()=>{vi.clearAllMocks();delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;mocks.resolve.mockResolvedValue({id:'session',organizationId:'org',userId:'requester',credentialKind:'desktop_session'});mocks.commercial.mockResolvedValue({allowed:true});mocks.store.mockReturnValue({lookup:vi.fn().mockResolvedValue(null),get:vi.fn(),cancel:vi.fn(),prepare:vi.fn()});});
describe('paired requester composition',()=>{
 it('keeps read recovery available while preparation is off',async()=>{const s=createAgentActionExecutionRequestService(request,{} as any,scope);await expect(s.lookup('proposal')).resolves.toBeNull();await expect(s.prepare('proposal')).rejects.toThrow();expect(mocks.store.mock.results[0].value.prepare).not.toHaveBeenCalled();});
 it.each(['organizationId','userId','id','credentialKind'])('rejects changed current %s through the locked store port',async key=>{createAgentActionExecutionRequestService(request,{} as any,scope);mocks.resolve.mockResolvedValue({id:'session',organizationId:'org',userId:'requester',credentialKind:'desktop_session',[key]:'other'});await expect(mocks.store.mock.calls[0][1].assertCurrent({},scope,'reader')).rejects.toThrow();});
 it('rechecks the default-off switch in executor authority',async()=>{process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';const s=createAgentActionExecutionRequestService(request,{} as any,scope);await s.prepare('p');delete process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED;await expect(mocks.store.mock.calls[0][1].assertCurrent({},scope,'executor')).rejects.toThrow();});
 it('rejects a caller scope substitution before authentication',async()=>{createAgentActionExecutionRequestService(request,{} as any,scope);await expect(mocks.store.mock.calls[0][1].assertCurrent({},{...scope,actorUserId:'other'},'reader')).rejects.toThrow();expect(mocks.resolve).not.toHaveBeenCalled();});
 it('requires current commercial access for preparation',async()=>{createAgentActionExecutionRequestService(request,{} as any,scope);process.env.AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED='true';mocks.commercial.mockResolvedValue({allowed:false});await expect(mocks.store.mock.calls[0][1].assertCurrent({},scope,'executor')).rejects.toThrow();});
});
