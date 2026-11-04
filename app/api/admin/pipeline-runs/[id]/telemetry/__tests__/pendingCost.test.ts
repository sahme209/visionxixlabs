import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({session:vi.fn(),read:vi.fn(),markers:vi.fn(),transaction:vi.fn()}));
vi.mock('next-auth',()=>({getServerSession:m.session}));
vi.mock('@/lib/auth',()=>({authOptions:{}}));
vi.mock('@/lib/admin/auth',()=>({isAdminEmail:(email:string)=>email==='admin@example.invalid'}));
vi.mock('@/lib/db',()=>({prisma:{pipelineRun:{findUnique:m.read},$transaction:m.transaction}}));
import {GET} from '../route';
const stage=(id='s',extra:Record<string,unknown>={})=>({id,stageId:id,stageKind:'code_propose',ordering:0,status:'succeeded',costCents:0,tokensInput:2,tokensOutput:1,latencyMs:10,completedAt:null,errorMessage:null,...extra});
const marker=(id='s',extra:Record<string,unknown>={})=>({id,costShape:'object',totalCents:null,pendingSettlement:true,...extra});
let stages:ReturnType<typeof stage>[];
let runStatus:string;
beforeEach(()=>{vi.clearAllMocks();runStatus='succeeded';stages=[stage()];m.session.mockResolvedValue({user:{email:'admin@example.invalid'}});m.read.mockImplementation(async()=>({id:'run',organizationId:'org',pipelineId:'ai_coding',status:runStatus,triggeredBy:'actor',startedAt:new Date('2026-11-04T00:00:00Z'),completedAt:null,errorSummary:null,stages}));m.markers.mockResolvedValue([marker()]);m.transaction.mockImplementation(async(fn:Function)=>fn({pipelineRun:{findUnique:m.read},$queryRawUnsafe:m.markers}));});
async function get(){return GET({} as Parameters<typeof GET>[0],{params:Promise.resolve({id:'run'})});}
it('reachable GET distinguishes pending recorded zero from final free cost',async()=>{
 const body=await(await get()).json();expect(body.stages[0]).toMatchObject({costCents:0,costState:'pending',finalCostCents:null});expect(body.rollup).toMatchObject({totalCostCents:0,hasCost:false,costState:'pending',finalTotalCostCents:null});
});
it('explicit settled zero is final and distinguishable from pending',async()=>{
 m.markers.mockResolvedValue([marker('s',{totalCents:0,pendingSettlement:false})]);const body=await(await get()).json();expect(body.stages[0]).toMatchObject({costState:'final',finalCostCents:0});expect(body.rollup).toMatchObject({costState:'final',finalTotalCostCents:0});
});
it('mixed settled and pending costs retain recorded projection but no final total',async()=>{
 stages=[stage('a',{costCents:7}),stage('b')];m.markers.mockResolvedValue([marker('a',{totalCents:7,pendingSettlement:false}),marker('b')]);const body=await(await get()).json();expect(body.rollup).toMatchObject({totalCostCents:7,costState:'pending',finalTotalCostCents:null});
});
it.each([{costShape:null,totalCents:null,pendingSettlement:null},{totalCents:0,pendingSettlement:'false'},{totalCents:-1,pendingSettlement:false},{totalCents:1,pendingSettlement:false}])('malformed or unbound coding cost %j is unknown',async value=>{
 m.markers.mockResolvedValue([marker('s',value)]);const body=await(await get()).json();expect(body.stages[0]).toMatchObject({costState:'unknown',finalCostCents:null});expect(body.rollup).toMatchObject({costState:'unknown',finalTotalCostCents:null});
});
it('a running coding stage with missing metadata cannot be verified zero',async()=>{
 stages=[stage('s',{status:'running'})];m.markers.mockResolvedValue([marker('s',{costShape:null,totalCents:null,pendingSettlement:null})]);expect((await(await get()).json()).stages[0]).toMatchObject({costState:'unknown',finalCostCents:null});
});
it('financial projections share one repeatable snapshot without selecting raw output detail',async()=>{
 await get();expect(m.transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:'RepeatableRead'});expect(m.read.mock.calls[0][0].select.stages.select.outputDetail).toBeUndefined();expect(m.markers).toHaveBeenCalledWith(expect.stringContaining('jsonb_typeof'), 'run');
});
it('financial marker strings never become public DTO fields',async()=>{
 m.markers.mockResolvedValue([marker('s',{totalCents:'PRIVATE_PAYLOAD_SENTINEL',pendingSettlement:false})]);const body=await(await get()).json();expect(body.stages[0].costState).toBe('unknown');expect(JSON.stringify(body)).not.toContain('PRIVATE_PAYLOAD_SENTINEL');expect(body.stages[0]).not.toHaveProperty('outputDetail');
});
it.each([null,{user:{email:'other@example.invalid'}}])('retains admin allowlist refusal without reading financial data',async session=>{
 m.session.mockResolvedValue(session);expect((await get()).status).toBe(403);expect(m.read).not.toHaveBeenCalled();expect(m.transaction).not.toHaveBeenCalled();
});
it('retains missing-run404 without a financial marker query',async()=>{m.read.mockResolvedValue(null);expect((await get()).status).toBe(404);expect(m.markers).not.toHaveBeenCalled();});

it('an active run cannot claim a final total from currently settled stage projections',async()=>{
 runStatus='running';m.markers.mockResolvedValue([marker('s',{totalCents:0,pendingSettlement:false})]);const body=await(await get()).json();expect(body.stages[0]).toMatchObject({costState:'final',finalCostCents:0});expect(body.rollup).toMatchObject({costState:'unknown',finalTotalCostCents:null});
});
