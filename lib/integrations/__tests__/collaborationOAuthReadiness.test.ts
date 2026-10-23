import {afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({callback:vi.fn(()=> 'https://visionxixlabs.com/callback')}));
vi.mock('../trustedCallbackUrl',()=>({trustedIntegrationCallbackUrl:m.callback}));
import {isCollaborationOAuthConfigured} from '../collaborationOAuthReadiness';
afterEach(()=>{vi.unstubAllEnvs();m.callback.mockReturnValue('https://visionxixlabs.com/callback');});
it.each([
 ['slack',['SLACK_CLIENT_ID','SLACK_CLIENT_SECRET']],
 ['teams',['MICROSOFT_CLIENT_ID','MICROSOFT_TENANT_ID','MICROSOFT_CLIENT_SECRET']],
 ['linear',['LINEAR_CLIENT_ID','LINEAR_CLIENT_SECRET']],
] as const)('requires every %s registration value and a trusted callback',(provider,keys)=>{
 for(const key of keys)vi.stubEnv(key,'value');
 expect(isCollaborationOAuthConfigured(provider)).toBe(true);
 for(const key of keys){vi.stubEnv(key,'  ');expect(isCollaborationOAuthConfigured(provider)).toBe(false);vi.stubEnv(key,'value');}
 m.callback.mockReturnValue(null as never);expect(isCollaborationOAuthConfigured(provider)).toBe(false);
});
