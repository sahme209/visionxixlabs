import 'server-only';
import type {PrismaClient} from '@prisma/client';
import {NextRequest} from 'next/server';
import {createPrivateDesktopTokenCodec} from '@/lib/desktop/privateDesktopToken';
import {createPrivateDesktopSessionService} from '@/lib/desktop/privateDesktopSession';
import {createPrivatePrismaDesktopSessionStore} from '@/lib/desktop/privateDesktopSessionStore.prisma';
import {createPrivateRequestDesktopSessionResolver} from '@/lib/desktop/privateRequestDesktopSessionResolver';
import {createPrivateDesktopCommercialAccessReader} from '@/lib/desktop/privateDesktopCommercialAccess';
import {encodeFixtureAuthorizationFrame,FIXTURE_TENANT,FIXTURE_SOCKET_DIRECTORY,type FixtureScenario} from './fixtureAuthorizationFrame';
export const FIXTURE_ACTORS=Object.freeze({requester:Object.freeze({userId:'qualification_requester',sessionId:'dsk.qualification.requester'}),reviewer:Object.freeze({userId:'qualification_reviewer',sessionId:'dsk.qualification.reviewer'})});
/** Trusted producer only. No route/package export; raw key is never returned. */
export async function mintFixedFixtureAuthorization(client:PrismaClient,sessionSigningKey:Uint8Array,scenarios:readonly FixtureScenario[],signal:AbortSignal):Promise<Uint8Array>{
 signal.throwIfAborted();const rows=await client.$queryRaw<Array<{database:string;actor:string;sockets:string;listen:string}>>`SELECT current_database() AS database,current_user AS actor,current_setting('unix_socket_directories') AS sockets,current_setting('listen_addresses') AS listen`;
 const socket=FIXTURE_SOCKET_DIRECTORY;
 if(rows.length!==1||rows[0].database!=='axiom_issuer_qualification'||rows[0].actor!=='axiom_fixture_admin'||rows[0].sockets!==socket||rows[0].listen!=='')throw Error('fixture_authentication_unavailable');signal.throwIfAborted();
 const codec=createPrivateDesktopTokenCodec(sessionSigningKey),sessions=createPrivateDesktopSessionService(createPrivatePrismaDesktopSessionStore(client),()=>new Date());
 const resolve=createPrivateRequestDesktopSessionResolver({repo:client,tokenCodec:codec,sessions,readDesktopCommercialAccess:createPrivateDesktopCommercialAccessReader(client,{kind:'legacy'}),selfHealPersonalWorkspaceMembership:null});
 const tokens:{requester:string;reviewer:string}={requester:'',reviewer:''};
 for(const actor of ['requester','reviewer']as const){signal.throwIfAborted();const fixed=FIXTURE_ACTORS[actor],token=codec.mintDesktopToken(fixed.sessionId);const request=new NextRequest('https://axiom.fixture.invalid/private-authorization',{headers:{authorization:'Bearer '+token},signal});const p=await resolve(request,{requiredScope:'pipeline:read',requiredCapability:actor==='requester'?'deploy:execute':'agent:approve',allowApiKey:false,requireWorkspaceMembership:true,recordHeartbeat:false,route:'fixed synthetic qualification authorization'});signal.throwIfAborted();if(!p||p.credentialKind!=='desktop_session'||p.id!==fixed.sessionId||p.userId!==fixed.userId||p.organizationId!==FIXTURE_TENANT)throw Error('fixture_authentication_unavailable');tokens[actor]=token;}
 signal.throwIfAborted();return encodeFixtureAuthorizationFrame({tenant:FIXTURE_TENANT,requesterToken:tokens.requester,reviewerToken:tokens.reviewer,scenarios:[...scenarios]});
}
