import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({session:vi.fn(),create:vi.fn(),ticket:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{changeTicket:{findFirst:m.ticket}}}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:m.session}));
vi.mock('@/lib/tauri/releaseResolutionDraft',async actual=>({...await actual<typeof import('@/lib/tauri/releaseResolutionDraft')>(),createReleaseResolutionDraft:m.create}));
const body=()=>({title:'Resolve release ticket',applications:['Checkout'],requestDetails:'Please identify the owning repository and pipeline.',ticketUrl:'https://tickets.example.test/42'});
const request=(value:unknown=body())=>new NextRequest('https://visionxixlabs.com/api/desktop/deployments/drafts',{method:'POST',headers:{'Content-Type':'application/json','x-correlation-id':'draft-retry-1'},body:JSON.stringify(value)});
beforeEach(()=>{vi.clearAllMocks();m.session.mockResolvedValue({organizationId:'org',userId:'user'});m.create.mockImplementation(async(_db,input)=>({ok:true,replayed:false,request:{id:input.draft.id,title:input.draft.title,status:'draft',version:1,correlationId:input.correlationId,submittedAt:null}}))});
it('binds draft identity to the paired session and returns a non-submitted draft',async()=>{const {POST}=await import('../route');const r=await POST(request({...body(),tenantId:'forged',id:'forged'}));expect(r.status).toBe(201);const b=await r.json();expect(b.data).toMatchObject({status:'draft',submittedAt:null,version:1});expect(b.data.id).not.toBe('forged');expect(m.create).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({organizationId:'org',requesterUserId:'user',draft:expect.objectContaining({tenantId:'org',kind:'resolution_draft',schemaVersion:1})}));expect(m.session).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredScope:'pipeline:trigger',allowApiKey:false}))});
it('requires existing submission authority without provider access',async()=>{m.session.mockResolvedValue(null);const {POST}=await import('../route');expect((await POST(request())).status).toBe(401);expect(m.create).not.toHaveBeenCalled()});
it.each([{...body(),productionReady:true},{...body(),workflowInputs:{publish:'true'}},{...body(),applications:[]}])('refuses complete execution controls or invalid drafts',async data=>{const {POST}=await import('../route');expect((await POST(request(data))).status).toBe(400);expect(m.create).not.toHaveBeenCalled()});
it('reports identical replay without creating another draft',async()=>{m.create.mockResolvedValue({ok:true,replayed:true,request:{id:'saved',title:'Saved',status:'draft',version:1,correlationId:'same',submittedAt:null}});const {POST}=await import('../route');expect((await POST(request())).status).toBe(200)});
it('reports correlation conflicts for operator review',async()=>{m.create.mockResolvedValue({ok:false,reason:'correlation_conflict'});const {POST}=await import('../route');expect((await POST(request())).status).toBe(409)});
it('sanitizes storage failures',async()=>{m.create.mockRejectedValue(new Error('private database diagnostic'));const {POST}=await import('../route');const r=await POST(request());expect(r.status).toBe(500);expect(await r.text()).not.toContain('private database diagnostic')});

it.each(["jira","servicenow"])("records only the paired workspace source for a %s ticket", async provider => {
  m.session.mockResolvedValue({id:"session",organizationId:"org",userId:"user",credentialKind:"desktop_session"});
  m.ticket.mockResolvedValue({id:"case-1",organizationId:"org",provider,externalKey:"CHG-10"});
  const {POST}=await import("../route");
  expect((await POST(request({...body(),sourceChangeTicketId:"case-1"}))).status).toBe(201);
  expect(m.ticket).toHaveBeenCalledWith(expect.objectContaining({where:{id:"case-1",organizationId:"org"}}));
  expect(m.create).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({
    draft:expect.objectContaining({sourceTicket:{id:"case-1",provider,reference:"CHG-10"}}),
  }));
});

it("rejects a foreign source and refuses client-supplied provenance", async () => {
  m.session.mockResolvedValue({id:"session",organizationId:"org",userId:"user",credentialKind:"desktop_session"});
  m.ticket.mockResolvedValue({id:"case-1",organizationId:"foreign",provider:"jira",externalKey:"Private"});
  const {POST}=await import("../route");
  expect((await POST(request({...body(),sourceChangeTicketId:"case-1"}))).status).toBe(404);
  expect((await POST(request({...body(),sourceTicket:{id:"case-1",provider:"jira",reference:"forged"}}))).status).toBe(400);
  expect(m.create).not.toHaveBeenCalled();
});
