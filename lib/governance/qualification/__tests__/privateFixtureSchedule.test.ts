import {expect,it,vi} from 'vitest';
import type{PrismaClient}from'@prisma/client';
import {loadFixedFixtureSchedule}from'../privateFixtureSchedule';
import {buildFixedFixtureScenarioInputs}from'../fixtureScenarioInputs';
function fixture(){const inputs=buildFixedFixtureScenarioInputs(new Date(),Array.from({length:10},(_,i)=>`${String(i+1).padStart(8,'0')}-1111-4111-8111-111111111111`));const row={organizationId:'qualification_workspace',workflowKind:'qualification_fixture_schedule',status:'completed',currentStep:'base_inputs',version:0,attemptCount:0,maxAttempts:1,requestedByUserId:'qualification_requester',leaseOwner:null,leaseExpiresAt:null,approvalProposalId:null,inputJson:{...inputs,providerPublicKey:'-----BEGIN PUBLIC KEY-----\nSIMULATED\n-----END PUBLIC KEY-----'}};const client={$queryRaw:vi.fn(async()=>[{database:'axiom_issuer_qualification',actor:'axiom_fixture_runtime',listen:'',sockets:'/Library/AxiomQ/c3b7bf334ce56a64575183b7a66e5109/socket'}]),durableAgentWorkflow:{findUnique:vi.fn(async()=>row)}};return{client:client as unknown as PrismaClient,row,inputs}}
it('rebuilds all persisted plan/source/schedule bytes using actual source constructors',async()=>{const f=fixture(),v=await loadFixedFixtureSchedule(f.client,new AbortController().signal);expect(v.inputs).toEqual(f.inputs);expect(Object.isFrozen(v)).toBe(true)});
it('coherently malformed source/plan cannot be adopted as fixture schedule',async()=>{const f=fixture();f.row.inputJson.groups[0].request.intakeJson.title='Changed';await expect(loadFixedFixtureSchedule(f.client,new AbortController().signal)).rejects.toThrow()});
it('wrong DB or revoked workflow refuses without fallback',async()=>{const f=fixture();f.row.status='cancelled';await expect(loadFixedFixtureSchedule(f.client,new AbortController().signal)).rejects.toThrow();const g=fixture();(g.client.$queryRaw as any).mockResolvedValue([{database:'customer',actor:'axiom_fixture_runtime',listen:'',sockets:''}]);await expect(loadFixedFixtureSchedule(g.client,new AbortController().signal)).rejects.toThrow()});

it.each([
 ['old', '/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/c3b7bf334ce56a64575183b7a66e5109/fixture/socket', ''],
 ['foreign', '/Library/AxiomQ/00000000000000000000000000000000/socket', ''],
 ['alias', '/Library/AxiomQ/c3b7bf334ce56a64575183b7a66e5109/../c3b7bf334ce56a64575183b7a66e5109/socket', ''],
 ['TCP', '/Library/AxiomQ/c3b7bf334ce56a64575183b7a66e5109/socket', 'localhost'],
])('refuses %s transport before workflow reads',async(_case,sockets,listen)=>{const f=fixture();(f.client.$queryRaw as any).mockResolvedValue([{database:'axiom_issuer_qualification',actor:'axiom_fixture_runtime',sockets,listen}]);await expect(loadFixedFixtureSchedule(f.client,new AbortController().signal)).rejects.toThrow('fixed_fixture_schedule_unavailable');expect(f.client.durableAgentWorkflow.findUnique).not.toHaveBeenCalled()});
