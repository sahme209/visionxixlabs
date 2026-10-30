import {serviceNowRequestedScopeSchema} from './serviceNowScopes';
import {serviceNowInstanceOriginSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
/** Display/navigation check only. The server owns registration and authorization state. */
export function serviceNowConsentDestination(value:string,expectedInstanceOrigin:string):string|null{
 try{
  const origin=serviceNowInstanceOriginSchema.parse(expectedInstanceOrigin),u=new URL(value),q=u.searchParams;
  if(value.length>4096||u.origin!==origin||u.protocol!=='https:'||u.username||u.password||u.port||u.hash||u.pathname!=='/oauth_auth.do')return null;
  const names=['response_type','client_id','redirect_uri','scope','state'];
  if([...q.keys()].length!==names.length||names.some(n=>q.getAll(n).length!==1)||q.get('response_type')!=='code'||!serviceNowRequestedScopeSchema.safeParse(q.get('scope')).success||q.get('redirect_uri')!=='https://visionxixlabs.com/api/integrations/servicenow/callback'||!/^[a-f0-9]{32}$/.test(q.get('client_id')??'')||!/^[A-Za-z0-9_-]{86}$/.test(q.get('state')??''))return null;
  return u.toString();
 }catch{return null}
}
