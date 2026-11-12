import 'server-only';
import type {PrismaClient} from '@/lib/prismaClient';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {FIXTURE_TENANT,FIXTURE_SOCKET_DIRECTORY} from './fixtureAuthorizationFrame';
import {FIXTURE_SCHEDULE_ID} from './privateFixtureBase';
import {buildFixedFixtureScenarioInputs} from './fixtureScenarioInputs';
/** Actual fixture runtime DB only; source-rebuild IDs bind persisted inert data. */
export async function loadFixedFixtureSchedule(client:PrismaClient,signal:AbortSignal){
 signal.throwIfAborted();const r=await client.$queryRaw<Array<{database:string;actor:string;listen:string;sockets:string}>>`SELECT current_database() AS database,current_user AS actor,current_setting('listen_addresses') AS listen,current_setting('unix_socket_directories') AS sockets`;
 if(r.length!==1||r[0].database!=='axiom_issuer_qualification'||r[0].actor!=='axiom_fixture_runtime'||r[0].listen!==''||r[0].sockets!==FIXTURE_SOCKET_DIRECTORY)throw Error('fixed_fixture_schedule_unavailable');
 const row=await client.durableAgentWorkflow.findUnique({where:{id:FIXTURE_SCHEDULE_ID}});signal.throwIfAborted();if(!row||row.organizationId!==FIXTURE_TENANT||row.workflowKind!=='qualification_fixture_schedule'||row.status!=='completed'||row.currentStep!=='base_inputs'||row.version!==0||row.attemptCount!==0||row.maxAttempts!==1||row.requestedByUserId!=='qualification_requester'||row.leaseOwner||row.leaseExpiresAt||row.approvalProposalId)throw Error('fixed_fixture_schedule_unavailable');
 const input=row.inputJson as unknown as Record<string,unknown>;if(!input||Object.keys(input).sort().join(',')!=='capturedAt,format,groups,providerPublicKey,scenarios'||typeof input.capturedAt!=='string'||!Array.isArray(input.scenarios)||typeof input.providerPublicKey!=='string'||!input.providerPublicKey.startsWith('-----BEGIN PUBLIC KEY-----')||input.providerPublicKey.length>16384)throw Error('fixed_fixture_schedule_unavailable');
 const rebuilt=buildFixedFixtureScenarioInputs(new Date(input.capturedAt),input.scenarios.map((x:unknown)=>(x as {clientRequestId:string}).clientRequestId));const{providerPublicKey,...stored}=input;if(sha256ContentHash(stored)!==sha256ContentHash(rebuilt)||Date.now()>=Date.parse(rebuilt.capturedAt)+15*60000||Date.now()<Date.parse(rebuilt.capturedAt))throw Error('fixed_fixture_schedule_unavailable');return Object.freeze({inputs:rebuilt,providerPublicKey});
}
