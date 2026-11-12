import 'server-only';
import {randomUUID} from 'node:crypto';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createPlatformIdentitySqlReader,type PlatformSqlDatabase} from '../sqlRepository';
import {readManualReleaseRecord,type ManualReleaseRepository} from './manualReleaseStore';
const fail=():never=>{throw Error('manual_release_storage_unavailable')};
/** Dedicated notice records; never inserted as fake executable platform actions.
 * Values are bound parameters, unknown commits never retried. */
export function createManualReleaseSqlRepository(db:PlatformSqlDatabase):ManualReleaseRepository{
 return {transaction:fn=>db.$transaction(async sql=>{
  let locked:string|null=null;
  const check=(id?:string)=>{if(locked===null||id!==undefined&&locked!==id)fail()};
  return fn({
   ...createPlatformIdentitySqlReader(sql,()=>check()),
   async lock(id){if(locked!==null)fail();await sql.$queryRawUnsafe('SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1,0))','axiom-platform-manual-release:'+id);locked=id},
   async now(){check();const rows=await sql.$queryRawUnsafe<Array<{now:number}>>('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::double precision AS now');if(rows.length!==1||!Number.isSafeInteger(rows[0].now))fail();return rows[0].now},
   async read(id){check(id);const rows=await sql.$queryRawUnsafe<Array<{stateJson:unknown;manifestDigest:string;version:number}>>('SELECT "stateJson","manifestDigest",version FROM "PlatformManualRelease" WHERE id=$1',id);
    if(!rows.length)return null;if(rows.length!==1)fail();const state=readManualReleaseRecord(rows[0].stateJson);if(state.id!==id||state.manifest.digest!==rows[0].manifestDigest||state.version!==rows[0].version)fail();return state},
   async insert(id,raw){check(id);const state=readManualReleaseRecord(raw);if(state.id!==id||state.version!==0)fail();await sql.$executeRawUnsafe('INSERT INTO "PlatformManualRelease" (id,"manifestDigest","stateJson",version,"updatedAt") VALUES ($1,$2,$3::jsonb,$4,clock_timestamp())',id,state.manifest.digest,JSON.stringify(state),state.version)},
   async replace(id,version,raw){check(id);const state=readManualReleaseRecord(raw);if(state.id!==id||state.version!==version+1)fail();const count=await sql.$executeRawUnsafe('UPDATE "PlatformManualRelease" SET "stateJson"=$1::jsonb,version=$2,"updatedAt"=clock_timestamp() WHERE id=$3 AND version=$4 AND "manifestDigest"=$5',JSON.stringify(state),state.version,id,version,state.manifest.digest);if(count!==1)fail()},
   async event(event){check(event.recordId);const state=readManualReleaseRecord(event.state);if(state.id!==event.recordId||state.status!==event.kind)fail();
    const detail={manifestDigest:state.manifest.digest,stateDigest:sha256ContentHash(state),status:state.status,attemptCount:state.attemptCount,providerExecution:false,ownerAuthorization:'external_not_verified'};
    await sql.$executeRawUnsafe('INSERT INTO "PlatformManualReleaseEvent" (id,"recordId",sequence,kind,"detailJson") VALUES ($1,$2,$3,$4,$5::jsonb)',randomUUID(),event.recordId,state.version,event.kind,JSON.stringify(detail));
   },
  });
 },{isolationLevel:'ReadCommitted',timeout:10000,maxWait:5000})};
}
