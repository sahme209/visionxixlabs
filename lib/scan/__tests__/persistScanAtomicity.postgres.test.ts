import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi}from'vitest';import{realpathSync,statSync}from'node:fs';import{randomUUID}from'node:crypto';import{PrismaClient}from'@prisma/client';
const f=vi.hoisted(()=>({client:undefined as unknown as PrismaClient,notify:vi.fn()}));vi.mock('@/lib/db',()=>({get prisma(){return f.client;}}));vi.mock('@/lib/notifications/scanCompleteNotifier',()=>({notifyScanComplete:f.notify}));
import{persistScanRun}from'../persistScanRun';import{id}from'@/lib/domain/ids';
const socket=process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
describe.skipIf(!socket)('legacy scan core storage atomicity on owned PostgreSQL',()=>{
 let org:string;const orgs:string[]=[];
 beforeAll(async()=>{if(!socket||!/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||statSync(socket).uid!==process.getuid?.())throw Error('owned_private_socket_required');f.client=new PrismaClient({datasources:{db:{url:`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`}}});const[binding]=await f.client.$queryRawUnsafe<Array<{private:boolean}>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);if(!binding?.private)throw Error('owned_fixture_binding_required');});
 beforeEach(()=>{org='owned_scan_'+randomUUID();orgs.push(org);f.notify.mockReset();f.notify.mockResolvedValue(undefined);});
 afterEach(async()=>{await f.client.$executeRawUnsafe('DROP TRIGGER IF EXISTS axiom_owned_scan_refuse ON "AxiomAgentRun"');await f.client.$executeRawUnsafe('DROP FUNCTION IF EXISTS public.axiom_owned_scan_refuse()');await f.client.$executeRawUnsafe('DROP TRIGGER IF EXISTS axiom_owned_content_refuse ON "AxiomFinding"');await f.client.$executeRawUnsafe('DROP TRIGGER IF EXISTS axiom_owned_content_refuse ON "AxiomRecommendation"');await f.client.$executeRawUnsafe('DROP TRIGGER IF EXISTS axiom_owned_content_refuse ON "AxiomApprovalItem"');await f.client.$executeRawUnsafe('DROP FUNCTION IF EXISTS public.axiom_owned_content_refuse()');});
 afterAll(async()=>{if(f.client){await f.client.axiomScheduledRun.deleteMany({where:{organizationId:{in:orgs}}});await f.client.axiomAgentRun.deleteMany({where:{organizationId:{in:orgs}}});await f.client.cloudAccount.deleteMany({where:{organizationId:{in:orgs}}});await f.client.$disconnect();}});
 const input=()=>({organizationId:id.organization(org),userId:id.user('owned_scan_user'),provider:'aws' as const,externalAccountId:'123456789012',region:'us-east-1',trigger:'scheduled' as const,snapshot:{resources:[]},findings:[],source:'live' as const});
 it('rolls back the new account if storing the corresponding run fails and sends no completion notification',async()=>{await f.client.$executeRawUnsafe(`CREATE FUNCTION public.axiom_owned_scan_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned_run_storage_unavailable'; END $$`);await f.client.$executeRawUnsafe(`CREATE TRIGGER axiom_owned_scan_refuse BEFORE INSERT ON "AxiomAgentRun" FOR EACH ROW EXECUTE FUNCTION public.axiom_owned_scan_refuse()`);const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});try{expect(await persistScanRun(input())).toBeNull();expect(await f.client.cloudAccount.count({where:{organizationId:org}})).toBe(0);expect(await f.client.axiomAgentRun.count({where:{organizationId:org}})).toBe(0);expect(f.notify).not.toHaveBeenCalled();}finally{warn.mockRestore();}});
 it('retains successful account and run persistence with completion notification after the transaction',async()=>{const result=await persistScanRun(input());expect(result).toMatchObject({findingCount:0,recommendationCount:0});expect(await f.client.cloudAccount.count({where:{organizationId:org}})).toBe(1);expect(await f.client.axiomAgentRun.count({where:{organizationId:org,status:'completed'}})).toBe(1);expect(f.notify).toHaveBeenCalledOnce();});
 it('restores an existing account unchanged when the corresponding run insert fails',async()=>{const before=await f.client.cloudAccount.create({data:{organizationId:org,provider:'aws',externalAccountId:'123456789012',regions:['us-west-2'],enabled:false,credentialRef:'owned_legacy_reference_no_secret'}});await f.client.$executeRawUnsafe(`CREATE FUNCTION public.axiom_owned_scan_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned_run_storage_unavailable'; END $$`);await f.client.$executeRawUnsafe(`CREATE TRIGGER axiom_owned_scan_refuse BEFORE INSERT ON "AxiomAgentRun" FOR EACH ROW EXECUTE FUNCTION public.axiom_owned_scan_refuse()`);const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});try{expect(await persistScanRun(input())).toBeNull();expect(await f.client.cloudAccount.findUniqueOrThrow({where:{id:before.id}})).toEqual(before);expect(f.notify).not.toHaveBeenCalled();}finally{warn.mockRestore();}});

 it('creates only a paused schedule after a manual scan, requiring a separate explicit activation',async()=>{expect(await persistScanRun({...input(),trigger:'manual'})).not.toBeNull();const schedule=await f.client.axiomScheduledRun.findFirstOrThrow({where:{organizationId:org}});expect(schedule.enabled).toBe(false);expect(schedule.lastDiffSummary).toContain('activation');});

 const finding=(title:string,index:number)=>({id:'owned_finding_'+index,snapshotId:id.snapshot('owned_snapshot'),ruleCode:'cost_idle',title,description:'Owned synthetic scan evidence',risk:'low' as const,resourceRef:'owned_resource_'+index,source:'live' as const});
 const recommendation=(title:string,index:number)=>({id:'owned_rec_'+index,findingId:'owned_finding_1',title,description:'Owned synthetic recommendation',actionClass:'cost_optimization' as const,monthlySavingsUsd:1,source:'live' as const});
 it.each(['finding','recommendation'] as const)('rolls back the complete scan core after a later %s insert fails',async kind=>{
  const before=kind==='recommendation'?await f.client.cloudAccount.create({data:{organizationId:org,provider:'aws',externalAccountId:'123456789012',regions:['us-west-2'],enabled:false}}):null;
  await f.client.$executeRawUnsafe(`CREATE FUNCTION public.axiom_owned_content_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title = 'refused-owned' THEN RAISE EXCEPTION 'owned_content_storage_unavailable'; END IF; RETURN NEW; END $$`);
  const table=kind==='finding'?'AxiomFinding':'AxiomRecommendation';
  await f.client.$executeRawUnsafe(`CREATE TRIGGER axiom_owned_content_refuse BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION public.axiom_owned_content_refuse()`);
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try{
   const data={...input(),findings:[finding('first-owned',1),finding(kind==='finding'?'refused-owned':'second-owned',2)],recommendations:[recommendation('first-owned',1),recommendation('refused-owned',2)]};
   expect(await persistScanRun(data)).toBeNull();
   expect(await f.client.axiomAgentRun.count({where:{organizationId:org}})).toBe(0);
   expect(await f.client.axiomFinding.count({where:{run:{organizationId:org}}})).toBe(0);
   expect(await f.client.axiomRecommendation.count({where:{run:{organizationId:org}}})).toBe(0);
   expect(f.notify).not.toHaveBeenCalled();
   if(before)expect(await f.client.cloudAccount.findUniqueOrThrow({where:{id:before.id}})).toEqual(before);
   else expect(await f.client.cloudAccount.count({where:{organizationId:org}})).toBe(0);
  }finally{warn.mockRestore();}
 });
 it('commits the linked findings and recommendations before notifying about a completed scan',async()=>{
  f.notify.mockImplementation(async()=>{expect(await f.client.axiomFinding.count({where:{run:{organizationId:org}}})).toBe(2);expect(await f.client.axiomRecommendation.count({where:{run:{organizationId:org}}})).toBe(1);});
  const result=await persistScanRun({...input(),findings:[finding('first-owned',1),finding('second-owned',2)],recommendations:[recommendation('first-owned',1)]});
  expect(result).toMatchObject({findingCount:2,recommendationCount:1});
  const run=await f.client.axiomAgentRun.findUniqueOrThrow({where:{id:result!.runId},include:{findings:true,recommendations:true}});
  expect(run.status).toBe('completed');expect(run.findings).toHaveLength(2);expect(run.recommendations).toHaveLength(1);
  expect(run.findings.map(row=>row.id)).toContain(run.recommendations[0].findingId);
  expect(f.notify).toHaveBeenCalledOnce();await f.notify.mock.results[0].value;
 });

 it('retains the committed scan when the separate legacy approval bridge is unavailable',async()=>{
  await f.client.$executeRawUnsafe(`CREATE FUNCTION public.axiom_owned_content_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned_approval_storage_unavailable'; END $$`);
  await f.client.$executeRawUnsafe(`CREATE TRIGGER axiom_owned_content_refuse BEFORE INSERT ON "AxiomApprovalItem" FOR EACH ROW EXECUTE FUNCTION public.axiom_owned_content_refuse()`);
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try{const result=await persistScanRun({...input(),findings:[finding('first-owned',1)],recommendations:[{...recommendation('refused-owned',1),actionClass:'security_remediation' as const}]});
   expect(result).toMatchObject({findingCount:1,recommendationCount:1});
   expect(await f.client.axiomAgentRun.count({where:{organizationId:org,status:'completed'}})).toBe(1);
   expect(await f.client.axiomRecommendation.count({where:{run:{organizationId:org}}})).toBe(1);
   expect(await f.client.axiomApprovalItem.count({where:{organizationId:org}})).toBe(0);expect(f.notify).toHaveBeenCalledOnce();
  }finally{warn.mockRestore();}
 });
 it('contains a rejected completion notification without changing committed scan success',async()=>{
  f.notify.mockRejectedValue(new Error('owned_notification_failed'));const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try{const result=await persistScanRun(input());expect(result).not.toBeNull();expect(await f.client.axiomAgentRun.count({where:{organizationId:org,status:'completed'}})).toBe(1);expect(warn).toHaveBeenCalledWith('[persistScanRun] completion notification failed');}finally{warn.mockRestore();}
 });

});
