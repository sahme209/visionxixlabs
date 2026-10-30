/** @vitest-environment jsdom */
import {createElement} from 'react';import {afterEach,beforeEach,expect,it,vi} from 'vitest';import {cleanup,render,screen,fireEvent,waitFor,act} from '@testing-library/react';
const m=vi.hoisted(()=>({request:vi.fn(),policy:vi.fn(),config:{},revision:0}));vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{config:m.config,getContextRevision:()=>m.revision,associatedTicketAction:m.request,ticketGovernanceReview:m.policy}}));
vi.mock('../../../desktop/src/components/CatalogIcon',()=>({ProviderLogo:()=>null}));
import {AssociatedTicketActionsPanel} from '../../../desktop/src/components/AssociatedTicketActionsPanel';
const hash='a'.repeat(64),id='jira_action_'+hash,review:any={id:'ticket_review_'+hash,version:1,status:'approved',bindingDigest:hash,current:true,binding:{kind:'ticket_release_association',ticket:{provider:'jira'}}};
const row:any={id,version:0,kind:'link',status:'awaiting_approval',payloadDigest:hash,expiresAt:'2030-01-01T00:15:00.000Z',attemptCount:0,providerWritePerformed:false,canApprove:true,canExecute:false,canCancel:false,review:{kind:'link',siteId:'site',connectionRevision:'revision',linkTitle:'Exact deployment link',linkGlobalId:'global',association:{reviewId:review.id,bindingDigest:hash},issueKey:'KAN-4',runUrl:'https://github.com/company/app/actions/runs/123'}};
beforeEach(()=>{vi.clearAllMocks();m.request.mockResolvedValue({ok:true,data:{provider:'jira',actions:[row],truncated:false}})});afterEach(cleanup);
it('loads existing review history once and requires its own checkbox before provider approval',async()=>{render(createElement(AssociatedTicketActionsPanel,{review}));await screen.findByText('Exact deployment link');expect(m.request).toHaveBeenCalledTimes(1);const button=screen.getByRole('button',{name:'Approve exact provider action'});expect(button.hasAttribute('disabled')).toBe(true);fireEvent.click(screen.getByLabelText('I reviewed this exact provider target and content.'));m.request.mockResolvedValue({ok:true,data:{provider:'jira',action:{...row,version:1,status:'approved',canApprove:false}}});fireEvent.click(button);await waitFor(()=>expect(m.request).toHaveBeenCalledTimes(2));expect(m.request.mock.calls[1][1]).toMatchObject({action:'approve',actionId:id,expectedVersion:0,bindingDigest:hash});expect(m.request.mock.calls.every(([,input])=>input.action!=='dispatch')).toBe(true)});
it('never offers a resend after a consumed unknown action',async()=>{m.request.mockResolvedValue({ok:true,data:{provider:'jira',actions:[{...row,status:'unknown',attemptCount:1,providerWritePerformed:null,canApprove:false}],truncated:false}});render(createElement(AssociatedTicketActionsPanel,{review}));await screen.findByText(/single attempt is consumed/);expect(screen.queryByRole('button',{name:'Send approved deployment link'})).toBeNull();expect(m.request).toHaveBeenCalledTimes(1)});
it('holds uncertain writes until a deliberate history refresh and does not retry',async()=>{render(createElement(AssociatedTicketActionsPanel,{review}));await screen.findByText('Exact deployment link');fireEvent.click(screen.getByLabelText('I reviewed this exact provider target and content.'));m.request.mockResolvedValue({ok:false,outcomeUnconfirmed:true});fireEvent.click(screen.getByRole('button',{name:'Approve exact provider action'}));await screen.findByText(/provider action outcome is unconfirmed/);expect(screen.getByRole('button',{name:'Save deployment link for separate review'}).hasAttribute('disabled')).toBe(true);expect(screen.getByRole('button',{name:'Reload associated action history'}).hasAttribute('disabled')).toBe(false);expect(m.request).toHaveBeenCalledTimes(2)});

it('requires an approved policy and refuses ServiceNow closure when native lifecycle has no terminal choice',async()=>{const snReview={...review,binding:{kind:'ticket_release_association',ticket:{provider:'servicenow'}}},snId='servicenow_action_'+hash; m.request.mockResolvedValue({ok:true,data:{provider:'servicenow',actions:[],truncated:false,acceptedLinks:[{id:snId,version:2,issueKey:'CHG0030002',runUrl:'https://github.com/company/app/actions/runs/123',sourceCommit:'b'.repeat(40),originalAssociationReviewId:review.id}]}});render(createElement(AssociatedTicketActionsPanel,{review:snReview}));const read=await screen.findByRole('button',{name:'Read closure options for existing confirmed link'});expect(read.hasAttribute('disabled')).toBe(true);m.policy.mockResolvedValue({ok:true,data:{...review,binding:{kind:'servicenow_terminal_policy'}}});fireEvent.change(screen.getByLabelText('Approved terminal policy review ID'),{target:{value:review.id}});fireEvent.click(screen.getByRole('button',{name:'Load approved terminal policy'}));await screen.findByText(/Approved terminal-state policy loaded/);m.request.mockResolvedValue({ok:true,data:{provider:'servicenow',closeOptions:{linkActionId:snId,linkVersion:2,terminalPolicy:{reviewId:review.id,bindingDigest:hash},expiresAt:'2030-01-01T00:15:00.000Z',transitions:[],fields:[]}}});fireEvent.click(read);await screen.findByText(/native lifecycle or required fields do not currently support closure/);expect(screen.getByRole('button',{name:'Save exact ServiceNow closure for independent review'}).hasAttribute('disabled')).toBe(true);expect(m.request.mock.calls.every(([,input])=>!['dispatch','prepare_servicenow_close'].includes(input.action))).toBe(true)});

it('disables a reviewed provider action at its deadline without another user interaction or request',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2030-01-01T00:14:59.000Z'));
 try{
  await act(async()=>{render(createElement(AssociatedTicketActionsPanel,{review}))});
  fireEvent.click(screen.getByLabelText('I reviewed this exact provider target and content.'));
  const button=screen.getByRole('button',{name:'Approve exact provider action'});expect(button.hasAttribute('disabled')).toBe(false);
  await act(async()=>{vi.advanceTimersByTime(1001)});
  expect(button.hasAttribute('disabled')).toBe(true);expect(screen.getByText(/This exact provider action has expired/)).toBeTruthy();expect(m.request).toHaveBeenCalledTimes(1);
 }finally{vi.useRealTimers()}
});

it('deliberately reads only the uncertain action outcome and never resends it',async()=>{
 const executable={...row,kind:'close',status:'approved',version:3,canApprove:false,canExecute:true};
 m.request.mockResolvedValueOnce({ok:true,data:{provider:'jira',actions:[executable],truncated:false}});
 render(createElement(AssociatedTicketActionsPanel,{review}));await screen.findByText('Exact deployment link');
 fireEvent.click(screen.getByLabelText('I reviewed this exact provider target and content.'));
 m.request.mockResolvedValueOnce({ok:false,outcomeUnconfirmed:true});
 fireEvent.click(screen.getByRole('button',{name:'Close approved ticket'}));await screen.findByText(/provider action outcome is unconfirmed/);
 m.request.mockResolvedValueOnce({ok:true,data:{provider:'jira',action:{...executable,version:5,status:'confirmed',attemptCount:1,providerWritePerformed:true,canExecute:false}}});
 fireEvent.click(screen.getByRole('button',{name:'Check saved action outcome'}));await screen.findByText('Provider write confirmed');
 expect(m.request.mock.calls[2][1]).toEqual({action:'load',bindingDigest:hash,actionId:id});
 expect(m.request.mock.calls.filter(([,input])=>input.action==='dispatch')).toHaveLength(1);
 expect(screen.queryByRole('button',{name:'Close approved ticket'})).toBeNull();
});
it('keeps uncertain execution held when a direct read still shows its old approval',async()=>{
 const executable={...row,kind:'close',status:'approved',version:3,canApprove:false,canExecute:true};
 m.request.mockResolvedValueOnce({ok:true,data:{provider:'jira',actions:[executable],truncated:false}});
 render(createElement(AssociatedTicketActionsPanel,{review}));await screen.findByText('Exact deployment link');fireEvent.click(screen.getByLabelText('I reviewed this exact provider target and content.'));
 m.request.mockResolvedValueOnce({ok:false,outcomeUnconfirmed:true});fireEvent.click(screen.getByRole('button',{name:'Close approved ticket'}));await screen.findByText(/provider action outcome is unconfirmed/);
 m.request.mockResolvedValueOnce({ok:true,data:{provider:'jira',action:executable}});fireEvent.click(screen.getByRole('button',{name:'Check saved action outcome'}));
 await waitFor(()=>expect(m.request).toHaveBeenCalledTimes(3));await act(async()=>{});
 expect(screen.getByRole('button',{name:'Close approved ticket'}).hasAttribute('disabled')).toBe(true);
 expect(m.request.mock.calls.filter(([,input])=>input.action==='dispatch')).toHaveLength(1);
});
it('recovers an exact saved result after reopening even when full history is unavailable',async()=>{
 m.request.mockResolvedValueOnce({ok:false,outcomeUnconfirmed:false});render(createElement(AssociatedTicketActionsPanel,{review}));await screen.findByText(/This action is unavailable/);
 fireEvent.change(screen.getByLabelText('Saved provider action ID'),{target:{value:id}});
 m.request.mockResolvedValueOnce({ok:true,data:{provider:'jira',action:{...row,version:5,kind:'close',status:'confirmed',attemptCount:1,providerWritePerformed:true,canApprove:false}}});
 fireEvent.click(screen.getByRole('button',{name:'Load saved action outcome'}));await screen.findByText('Provider write confirmed');
 expect(m.request.mock.calls[1][1]).toEqual({action:'load',bindingDigest:hash,actionId:id});expect(m.request).toHaveBeenCalledTimes(2);
});

it('checks exact ServiceNow absence before deliberately preparing a separate review, never sending automatically',async()=>{
 const parent={...row,id:'servicenow_action_'+hash,version:8,status:'refused',attemptCount:1,canApprove:false,review:{...row.review,issueNumber:'CHG0030002'}};
 const snReview={...review,binding:{kind:'ticket_release_association',ticket:{provider:'servicenow'}}};
 m.request.mockResolvedValueOnce({ok:true,data:{provider:'servicenow',actions:[parent],truncated:false}});
 render(createElement(AssociatedTicketActionsPanel,{review:snReview}));
 const check=await screen.findByRole('button',{name:'Check exact journal proof'});
 expect(screen.queryByRole('button',{name:'Prepare fresh note for independent review'})).toBeNull();
 m.request.mockResolvedValueOnce({ok:true,data:{provider:'servicenow',journalProof:{parentActionId:parent.id,parentVersion:8,accessVerified:true,absent:true,noteDigest:hash,checkedAt:new Date().toISOString()}}});
 fireEvent.click(check);const prepare=await screen.findByRole('button',{name:'Prepare fresh note for independent review'});
 expect(m.request.mock.calls[1][1]).toEqual({action:'check_servicenow_journal',bindingDigest:hash,parentActionId:parent.id,parentVersion:8});
 expect(m.request).toHaveBeenCalledTimes(2);
 m.request.mockResolvedValueOnce({ok:false});fireEvent.click(prepare);
 await waitFor(()=>expect(m.request).toHaveBeenCalledTimes(3));
 expect(m.request.mock.calls[2][1]).toMatchObject({action:'prepare_servicenow_fresh_link',parentActionId:parent.id,parentVersion:8});
 expect(m.request.mock.calls.every(([,input])=>input.action!=='dispatch')).toBe(true);
});
it('never offers a fresh note for uncertain writes or a child attempt',async()=>{
 const snReview={...review,binding:{kind:'ticket_release_association',ticket:{provider:'servicenow'}}};
 m.request.mockResolvedValue({ok:true,data:{provider:'servicenow',actions:[{...row,id:'servicenow_action_'+hash,status:'refused',attemptCount:1,providerWritePerformed:null,canApprove:false}],truncated:false}});
 render(createElement(AssociatedTicketActionsPanel,{review:snReview}));await screen.findByText('Provider outcome unconfirmed');expect(screen.queryByRole('button',{name:'Check exact journal proof'})).toBeNull();
});
