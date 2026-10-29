/** @vitest-environment jsdom */
import {createElement} from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({get:vi.fn(),mutate:vi.fn()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{listConnectedActions:m.get,mutateConnectedAction:m.mutate,connectedActionPending:()=>undefined}}));
import {ConnectedActionsPanel} from '../../../desktop/src/components/ConnectedActionsPanel';
afterEach(cleanup);
it('an independent reviewer sees review controls without issue-authoring fields or manager-only discovery',async()=>{
 const action={id:'connected_action_'+'a'.repeat(64),intent:{kind:'linear_issue_update',provider:'linear',teamId:'team',issueId:'issue',title:'Exact issue update',description:'Reviewed description',expiresAt:'2099-01-01T00:00:00Z'},intentDigest:'b'.repeat(64),state:'requested',version:0,attemptCount:0,canApprove:true,canExecute:false,canCancel:false,canRecover:false};
 m.get.mockResolvedValue({ok:true,data:{provider:'linear',enabled:true,canRequest:false,canApprove:true,actions:[action],truncated:false,targets:{workspaceName:'Axiom',observedAt:'2030-01-01T00:00:00Z',selectedTeamId:'team',teams:[{id:'team',name:'Engineering'}],channels:[],states:[],issues:[],hasMore:false,canCreate:true,canUpdate:true}}});m.mutate.mockResolvedValue({ok:false,error:'Synthetic refusal'});
 render(createElement(ConnectedActionsPanel,{provider:'linear',canManage:false,onClose:()=>{}}));
 const approve=await screen.findByText('Approve exact action');
 expect(screen.queryByText('Load authorized targets')).toBeNull();expect(screen.queryByText('Save exact action for review')).toBeNull();expect(screen.queryByRole('combobox')).toBeNull();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(approve);
 await screen.findByRole('alert');expect(m.mutate.mock.calls[0].slice(0,2)).toMatchObject(['linear',{action:'approve',id:action.id,expectedVersion:0}]);
});
it('blocks task-linked drafting against an older service rather than submitting an unsupported task binding',async()=>{
 m.get.mockResolvedValue({ok:false,error:'Task-linked app workflows are not activated on this service yet.'});m.mutate.mockClear();render(createElement(ConnectedActionsPanel,{provider:'linear',canManage:true,sourceTask:{taskId:'bot_'+'a'.repeat(64),expectedVersion:2},onClose:()=>{}}));await screen.findByRole('alert');expect(screen.getByText('Load authorized targets')).toHaveProperty('disabled',true);expect(m.mutate).not.toHaveBeenCalled();
});
