import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {PrismaClient} from "@/lib/prismaClient";
import {inspectAgentStorageRecovery,type AgentRecoveryRepository} from "../agentStorageRecovery";
const databaseUrl=process.env.AXIOM_AGENT_RECOVERY_SQL_TEST_DATABASE_URL;
/** Query/transaction compatibility only. The repository below deliberately uses
 * an owned local cluster, so this is NOT serving-production binding evidence. */
describe.skipIf(!databaseUrl)("Agent recovery metadata query on owned PG17",()=>{
 let db:PrismaClient;
 const env={VERCEL_ENV:"production",DATABASE_URL:"postgresql://synthetic:synthetic@ep-small-mountain-ailw0kvt.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"};
 beforeAll(async()=>{
  const target=new URL(databaseUrl!);
  if(target.protocol!=="postgresql:"||target.hostname!=="localhost"||target.password||target.pathname!=="/neondb"||[...target.searchParams.keys()].some(k=>k!=="host")||target.searchParams.getAll("host").length!==1||!/^\/private\/tmp\/axiom-recovery-pg\.[A-Za-z0-9]+\/socket$/.test(target.searchParams.get("host")??""))throw Error("owned_recovery_query_database_required");
  db=createDatabaseClient(target.toString());
  const [binding]=await db.$queryRawUnsafe<Array<{database:string;version:number}>>("SELECT current_database() AS database,current_setting('server_version_num')::int AS version");
  expect(binding.database).toBe("neondb");expect(Math.floor(binding.version/10000)).toBe(17);
  const tables=await db.$queryRawUnsafe<Array<{count:number}>>("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");expect(tables[0].count).toBe(0);
  await db.$executeRawUnsafe('CREATE TABLE public."User" (id text PRIMARY KEY)');
  await db.$executeRawUnsafe('CREATE TABLE public."_prisma_migrations" (migration_name text,checksum text,finished_at timestamp,rolled_back_at timestamp)');
  await db.$executeRawUnsafe(`INSERT INTO public."_prisma_migrations" VALUES ('20261013172000_add_workspace_agent_identity','761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7',NULL,NULL)`);
 });
 afterAll(async()=>{await db?.$disconnect();});
 it("runs the exact query against a real database and leaves all rows/schema intact",async()=>{
  const value=await inspectAgentStorageRecovery(db as unknown as AgentRecoveryRepository,env);
  expect(value).toMatchObject({state:"verified",schemaOnlyPreconditionsMatch:true,agentIdentityTablePresent:false,repairAuthorized:false,recoveryPointVerified:false,isolatedRestoreVerified:false});
  const [count]=await db.$queryRawUnsafe<Array<{count:number}>>('SELECT count(*)::int AS count FROM public."_prisma_migrations"');expect(count.count).toBe(1);
  const [userCount]=await db.$queryRawUnsafe<Array<{count:number}>>('SELECT count(*)::int AS count FROM public."User"');expect(userCount.count).toBe(0);
 });
 it("really rejects writes inside the helper's read-only transaction",async()=>{
  let rejected=false;
  const repo:AgentRecoveryRepository={$transaction:async(operation,options)=>db.$transaction(async tx=>operation({$executeRawUnsafe:q=>tx.$executeRawUnsafe(q),$queryRawUnsafe:async<T>(q:string)=>{
   try{await tx.$executeRawUnsafe('CREATE TABLE public.forbidden_probe_write (id int)');}catch{rejected=true;throw Error("owned_probe_write_denied");}
   return tx.$queryRawUnsafe<T>(q);
  }}),options)};
  expect((await inspectAgentStorageRecovery(repo,env)).state).toBe("unavailable");expect(rejected).toBe(true);
  const [row]=await db.$queryRawUnsafe<Array<{present:boolean}>>("SELECT to_regclass('public.forbidden_probe_write') IS NOT NULL AS present");expect(row.present).toBe(false);
 });
});
