import {beforeEach,describe,expect,it,vi} from "vitest";
import {configuredAgentRecoveryTarget,inspectAgentStorageRecovery} from "../agentStorageRecovery";
const url="postgresql://PRIVATE_USER:PRIVATE_PASSWORD@ep-small-mountain-ailw0kvt-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const environment={VERCEL_ENV:"production",DATABASE_URL:url};
const m={execute:vi.fn(),query:vi.fn(),transaction:vi.fn()};
const row={database_name:"neondb",read_only:"on",server_version_num:170011,identity_table_present:false,baseline_user_present:true,unfinished_attempts:1,matching_unfinished:1,finished_attempts:0};
beforeEach(()=>{vi.resetAllMocks();m.execute.mockResolvedValue(0);m.query.mockResolvedValue([row]);m.transaction.mockImplementation(async fn=>fn({$executeRawUnsafe:m.execute,$queryRawUnsafe:m.query}));});
describe("fixed-target read-only Agent storage evidence",()=>{
 it("recognizes only the approved production connection without retaining its credentials",()=>{
  expect(configuredAgentRecoveryTarget(environment)).toBe(true);
  expect(configuredAgentRecoveryTarget({...environment,DATABASE_URL:url.replace('-pooler','')})).toBe(true);
 });
 it.each([
  {...environment,VERCEL_ENV:"preview"}, {...environment,AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME:"1"},
  {...environment,DATABASE_URL:url.replace('neondb','foreign')},
  {...environment,DATABASE_URL:url.replace('.neon.tech','.neon.tech.attacker.invalid')},
  {...environment,DATABASE_URL:url.replace('small-mountain-ailw0kvt','foreign-branch')},
  {...environment,DATABASE_URL:url+'&host=localhost'},
  {...environment,DATABASE_URL:url+'&schema=foreign'},
  {...environment,DATABASE_URL:url+'&sslmode=disable'},
  {...environment,DATABASE_URL:url.replace('sslmode=require','sslmode=disable')},
  {...environment,DATABASE_URL:"PRIVATE malformed URL"},
 ])("rejects uncertain or overridden targets %#",env=>expect(configuredAgentRecoveryTarget(env)).toBe(false));
 it("does not contact an unverified target",async()=>{
  const value=await inspectAgentStorageRecovery({$transaction:m.transaction},{...environment,VERCEL_ENV:"preview"});
  expect(value.state).toBe("target_unverified");expect(m.transaction).not.toHaveBeenCalled();expect(value.repairAuthorized).toBe(false);
 });
 it("checks actual metadata in a bounded read-only transaction, without implying repair authority",async()=>{
  const value=await inspectAgentStorageRecovery({$transaction:m.transaction},environment);
  expect(m.execute.mock.calls.map(x=>x[0])).toEqual(["SET TRANSACTION READ ONLY","SET LOCAL statement_timeout = '2s'","SET LOCAL lock_timeout = '500ms'"]);
  expect(m.transaction).toHaveBeenCalledWith(expect.any(Function),{maxWait:1000,timeout:5000});
  expect(value).toEqual({state:"verified",configuredTargetMatch:true,observedDatabaseMatch:true,engineMajorMatch:true,agentIdentityTablePresent:false,schemaOnlyPreconditionsMatch:true,repairAuthorized:false,recoveryPointVerified:false,isolatedRestoreVerified:false});
  expect(JSON.stringify(value)).not.toMatch(/PRIVATE|neondb|neon.tech|migration_checksum|761c693/);
 });
 it.each([{read_only:"off"},{database_name:"foreign"},{server_version_num:180000},{identity_table_present:"false"},{unfinished_attempts:"1"}])("fails closed on unexpected metadata %#",async change=>{
  m.query.mockResolvedValue([{...row,...change}]);const value=await inspectAgentStorageRecovery({$transaction:m.transaction},environment);
  expect(value.state).toBe("metadata_unverified");expect(value.schemaOnlyPreconditionsMatch).toBe(false);expect(value.repairAuthorized).toBe(false);
 });
 it.each([{baseline_user_present:false},{identity_table_present:true},{unfinished_attempts:2},{matching_unfinished:0},{finished_attempts:1}])("does not treat changed migration/table state as eligible %#",async change=>{
  m.query.mockResolvedValue([{...row,...change}]);const value=await inspectAgentStorageRecovery({$transaction:m.transaction},environment);
  expect(value.state).toBe("verified");expect(value.schemaOnlyPreconditionsMatch).toBe(false);expect(value.repairAuthorized).toBe(false);
 });
 it("returns a bounded unavailable state without retaining connection errors",async()=>{
  m.transaction.mockRejectedValue(new Error(url));const value=await inspectAgentStorageRecovery({$transaction:m.transaction},environment);
  expect(value.state).toBe("unavailable");expect(JSON.stringify(value)).not.toContain("PRIVATE");expect(value.repairAuthorized).toBe(false);
 });
});
