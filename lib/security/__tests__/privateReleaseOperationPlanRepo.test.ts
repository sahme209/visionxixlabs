import {PrismaClient} from '@prisma/client';
import {describe,it,expect,vi} from 'vitest';
import type {ReleaseOperationPlanRepo} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createPrivateReleaseOperationPlanRepo} from '../privateReleaseOperationPlanRepo';

describe('private release plan Prisma adapter (simulated delegates, no SQL)',()=>{
 it('accepts an actual lazy Prisma client and forwards supplied args, results and errors',async()=>{
  const client=new PrismaClient({datasources:{db:{url:'postgresql://synthetic:synthetic@127.0.0.1:1/private_test'}}});
  const repo=createPrivateReleaseOperationPlanRepo(client);
  expect(repo.gitHubInstallation).toBe(client.gitHubInstallation);
  const storeContract:ReleaseOperationPlanRepo=repo;expect(storeContract).toBe(repo);
  const failure=new Error('owned delegate error');
  for(const [name,methods] of [['durableAgentWorkflow',['findFirst','findMany','create','updateMany']],['durableAgentWorkflowEvent',['findMany','create']]] as const){
   for(const method of methods){
    const delegate=client[name];
    const result={owned:method};
    const spy=vi.spyOn(delegate,method as 'findMany').mockResolvedValueOnce(result as never).mockRejectedValueOnce(failure);
    const args={where:{organizationId:'owned'},data:{detailJson:{owned:true}},orderBy:[{id:'desc'}],take:6};
    // Test-only dynamic indexing covers each existing legacy method with one fixture.
    const call=(repo[name] as unknown as Record<string,(args:unknown)=>Promise<unknown>>)[method];
    expect(await call(args)).toBe(result);
    expect(spy).toHaveBeenLastCalledWith(args);expect(spy.mock.calls[0][0]).toBe(args);
    await expect(call(args)).rejects.toBe(failure);spy.mockRestore();
   }
  }
  await client.$disconnect();
 });
 it('uses the supplied transaction delegates and preserves options, raw parameters, result and rejection',async()=>{
  const client=new PrismaClient({datasources:{db:{url:'postgresql://synthetic:synthetic@127.0.0.1:1/private_test'}}});
  const tx=new PrismaClient({datasources:{db:{url:'postgresql://synthetic:synthetic@127.0.0.1:1/owned_tx'}}});
  const rawResult=[{owned:true}],value={nested:true},options={maxWait:17,timeout:29},result={result:true};
  const txRaw=vi.spyOn(tx,'$queryRaw').mockResolvedValue(rawResult);
  const rootRaw=vi.spyOn(client,'$queryRaw').mockRejectedValue(new Error('root must not run inside tx'));
  const find=vi.spyOn(tx.durableAgentWorkflow,'findFirst').mockResolvedValue(null);
  const transaction=vi.spyOn(client,'$transaction').mockImplementation(async callback=>{
   if(typeof callback!=='function')throw new Error('interactive transaction required');
   return callback(tx);
  });
  const repo=createPrivateReleaseOperationPlanRepo(client);
  expect(repo.gitHubInstallation).toBe(client.gitHubInstallation);
  const storeContract:ReleaseOperationPlanRepo=repo;expect(storeContract).toBe(repo);
  let query:TemplateStringsArray|undefined;
  expect(await repo.$transaction(async scoped=>{
   expect(scoped).not.toBe(repo);
   await scoped.durableAgentWorkflow.findFirst({where:{id:'owned'}});
   const tag=(strings:TemplateStringsArray,...values:unknown[])=>{query=strings;return scoped.$queryRaw(strings,...values)};
   expect(await tag`SELECT ${value}`).toBe(rawResult);
   return result;
  },options)).toBe(result);
  expect(transaction.mock.calls[0][1]).toBe(options);expect(txRaw.mock.calls[0][0]).toBe(query);expect(txRaw.mock.calls[0][1]).toBe(value);
  expect(rootRaw).not.toHaveBeenCalled();expect(find).toHaveBeenCalledWith({where:{id:'owned'}});
  const error=new Error('callback failure');await expect(repo.$transaction(async()=>{throw error})).rejects.toBe(error);
  rootRaw.mockResolvedValue(rawResult);expect(await repo.$queryRaw`SELECT ${value}`).toBe(rawResult);
  vi.restoreAllMocks();await client.$disconnect();await tx.$disconnect();
 });
});
