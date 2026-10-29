import {describe,expect,it} from 'vitest';
import {buildCloudAuthorization,cloudConnectionOutcome} from '../authorization';
const base={clientId:'client-id',redirectUri:'https://visionxixlabs.com/api/integrations/gcp-cloud/callback',state:'a'.repeat(43),verifier:'b'.repeat(64)};
describe('guided cloud authorization',()=>{
 it('opens Google consent with PKCE and fixed read-only cloud scope',()=>{
  const u=new URL(buildCloudAuthorization({provider:'gcp',...base}));
  expect(u.origin).toBe('https://accounts.google.com');expect(u.pathname).toBe('/o/oauth2/v2/auth');
  expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/cloud-platform.read-only');
  expect(u.searchParams.get('code_challenge_method')).toBe('S256');expect(u.searchParams.get('code_challenge')).not.toBe(base.verifier);
  expect(u.searchParams.get('access_type')).toBe('offline');expect(u.searchParams.get('include_granted_scopes')).toBe('false');
 });
 it('uses a dedicated Azure registration and exact tenant ARM consent, not Teams identity scopes',()=>{
  const u=new URL(buildCloudAuthorization({provider:'azure',...base,tenantId:'2e995f35-a47d-49bf-beed-19f4343f4612',redirectUri:'https://visionxixlabs.com/api/integrations/azure-cloud/callback'}));
  expect(u.origin).toBe('https://login.microsoftonline.com');expect(u.pathname).toBe('/2e995f35-a47d-49bf-beed-19f4343f4612/oauth2/v2.0/authorize');
  expect(u.searchParams.get('scope')).toBe('offline_access https://management.azure.com/user_impersonation');
  expect(u.searchParams.get('scope')).not.toContain('User.Read');
 });
 it.each(['http://visionxixlabs.com/api/integrations/gcp-cloud/callback','https://evil.example/api/integrations/gcp-cloud/callback','https://visionxixlabs.com/api/integrations/teams/callback','https://visionxixlabs.com/api/integrations/gcp-cloud/callback?x=1'])('rejects an untrusted or wrong callback %s',(redirectUri)=>expect(()=>buildCloudAuthorization({provider:'gcp',...base,redirectUri})).toThrow());
 it('rejects malformed security values instead of accepting caller-supplied scopes/endpoints',()=>{
  expect(()=>buildCloudAuthorization({provider:'gcp',...base,state:'short'})).toThrow();
  expect(()=>buildCloudAuthorization({provider:'gcp',...base,verifier:'short'})).toThrow();
  expect(()=>buildCloudAuthorization({provider:'azure',...base,tenantId:'common/evil'})).toThrow();
  expect(()=>buildCloudAuthorization({provider:'gcp',...base,clientId:'a\nb'})).toThrow();
 });
 it('does not offer an AWS OAuth flow or silently fall back to a different provider',()=>expect(()=>buildCloudAuthorization({provider:'aws',...base} as never)).toThrow());
});
describe('automatic cloud return outcome',()=>{
 const proof={provider:'gcp' as const,expectedResourceId:'axiom-visionxixlabs',observedResourceId:'axiom-visionxixlabs',currentAuthority:true,credentialSaved:true,resourceReadVerified:true,selectedResource:true};
 it('shows connected only after resource validation and durable credential save',()=>expect(cloudConnectionOutcome(proof)).toEqual({status:'connected_read_only',deploymentAvailable:false}));
 it.each(['credentialSaved','resourceReadVerified','currentAuthority','selectedResource'] as const)('never promotes incomplete %s',(key)=>expect(cloudConnectionOutcome({...proof,[key]:false}).status).not.toBe('connected_read_only'));
 it('offers selection when authorization works but no project is selected',()=>expect(cloudConnectionOutcome({...proof,selectedResource:false}).status).toBe('selection_required'));
 it('refuses a different resource even after valid login',()=>expect(cloudConnectionOutcome({...proof,observedResourceId:'other-project'}).status).toBe('resource_mismatch'));
 it('refuses revoked authority before considering provider success',()=>expect(cloudConnectionOutcome({...proof,currentAuthority:false,selectedResource:false}).status).toBe('authorization_required'));
 it('does not treat empty resource IDs as verified access',()=>expect(cloudConnectionOutcome({...proof,expectedResourceId:'',observedResourceId:''}).status).not.toBe('connected_read_only'));
});
