/** @vitest-environment jsdom */
import {createElement} from 'react';import {it,expect,vi,afterEach,beforeEach} from 'vitest';import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
const m=vi.hoisted(()=>({channels:vi.fn(),connected:vi.fn(),history:vi.fn(),mutate:vi.fn(),requestId:vi.fn(),config:{},revision:0}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{get config(){return m.config},getContextRevision:()=>m.revision,subscribeContext:()=>()=>{},listSlackChannels:m.channels,listSlackNotifications:m.history,mutateSlackNotification:m.mutate,slackNotificationNeedsReload:()=>false,slackNotificationRequestId:m.requestId}}));
vi.mock('../../../desktop/src/components/ConnectedActionsPanel',()=>({ConnectedActionsPanel:(p:any)=>{m.connected(p);return createElement('div',null,'Existing governed actions')}}));
import {BotConnectedActionsPanel} from '../../../desktop/src/components/BotConnectedActionsPanel';
const sourceTask={taskId:'bot_'+'a'.repeat(64),expectedVersion:2},channel={id:'C123456789',name:'acceptance',isMember:true},other={id:'C987654321',name:'other',isMember:true};
const page={workspaceId:'T123456789',connectionVersion:'2030-01-01T00:00:00.000Z',channels:[channel],nextCursor:'page2'};
beforeEach(()=>{vi.resetAllMocks();m.config={};m.revision=0;m.history.mockResolvedValue({ok:true,data:{enabled:true,writeAvailable:true,approvals:[],operations:[],truncated:false}})});afterEach(cleanup);
async function loadSelected(){
 m.channels.mockResolvedValueOnce({ok:true,data:page});render(createElement(BotConnectedActionsPanel,{provider:'slack',sourceTask,canManage:true,onClose:vi.fn()}));
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Load Slack channels'})));await act(async()=>fireEvent.change(screen.getByLabelText('Bot Slack channel'),{target:{value:channel.id}}));
 const input=screen.getByRole('textbox',{name:'Slack message'});fireEvent.change(input,{target:{value:'Keep this unsaved exact message'}});return input;
}
it('reuses the existing governed executor panel with exact saved-task binding and no auto action',()=>{render(createElement(BotConnectedActionsPanel,{provider:'linear',sourceTask,canManage:true,onClose:vi.fn()}));expect(m.connected).toHaveBeenCalledWith(expect.objectContaining({provider:'linear',sourceTask,canManage:true}));expect(m.channels).not.toHaveBeenCalled()});
it('loads channels only on explicit request and passes the selected target plus task to the real composer',async()=>{
 m.channels.mockResolvedValue({ok:true,data:{...page,channels:[channel,{...other,isMember:false}],nextCursor:undefined}});
 render(createElement(BotConnectedActionsPanel,{provider:'slack',sourceTask,canManage:true,onClose:vi.fn()}));expect(m.channels).not.toHaveBeenCalled();expect(screen.queryByRole('textbox',{name:'Slack message'})).toBeNull();
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Load Slack channels'})));expect(screen.getByRole('option',{name:'#other · invite Axiom first'})).toHaveProperty('disabled',true);
 await act(async()=>fireEvent.change(screen.getByLabelText('Bot Slack channel'),{target:{value:channel.id}}));expect(screen.getByRole('textbox',{name:'Slack message'})).toBeTruthy();expect(screen.getByText(/Workspace T123456789 · #acceptance/)).toBeTruthy();expect(m.history).toHaveBeenLastCalledWith({taskId:sourceTask.taskId},expect.any(AbortSignal));expect(m.mutate).not.toHaveBeenCalled();
});
it('keeps target discovery unavailable to a reviewer without management authority',()=>{render(createElement(BotConnectedActionsPanel,{provider:'slack',sourceTask,canManage:false,onClose:vi.fn()}));expect(screen.queryByRole('button',{name:'Load Slack channels'})).toBeNull();expect(m.channels).not.toHaveBeenCalled()});
it('preserves the actual selected composer and unsaved text across bounded same-connection pages without mutation or extra history reads',async()=>{
 const input=await loadSelected(),reads=m.history.mock.calls.length;
 m.channels.mockResolvedValueOnce({ok:true,data:{...page,channels:[other],nextCursor:'page3'}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'More channels'})));
 expect(screen.getByRole('textbox',{name:'Slack message'})).toBe(input);expect(input).toHaveProperty('value','Keep this unsaved exact message');expect(screen.getByLabelText('Bot Slack channel')).toHaveProperty('value',channel.id);expect(m.history).toHaveBeenCalledTimes(reads);
 const third={id:'C333333333',name:'third',isMember:true};m.channels.mockResolvedValueOnce({ok:true,data:{...page,channels:[third],nextCursor:'page4'}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'More channels'})));
 expect(screen.getByRole('textbox',{name:'Slack message'})).toBe(input);expect(screen.queryByRole('option',{name:'#other'})).toBeNull();expect(screen.getAllByRole('option')).toHaveLength(3);expect(m.channels.mock.calls[1][0]).toBe('page2');expect(m.channels.mock.calls[2][0]).toBe('page3');expect(m.mutate).not.toHaveBeenCalled();expect(m.requestId).not.toHaveBeenCalled();
});
it.each([{workspaceId:'T999999999'},{connectionVersion:'2030-01-02T00:00:00.000Z'}])('clears the old composer when a page changes its verified boundary (%j)',async boundary=>{
 await loadSelected();m.channels.mockResolvedValueOnce({ok:true,data:{...page,...boundary,channels:[channel]}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'More channels'})));
 expect(screen.getByLabelText('Bot Slack channel')).toHaveProperty('value','');expect(screen.queryByRole('textbox',{name:'Slack message'})).toBeNull();expect(screen.queryByRole('button',{name:'Save for independent review'})).toBeNull();
 await act(async()=>fireEvent.change(screen.getByLabelText('Bot Slack channel'),{target:{value:channel.id}}));expect(screen.getByRole('textbox',{name:'Slack message'})).toHaveProperty('value','');expect(m.mutate).not.toHaveBeenCalled();
});
it('uses a fresh duplicate membership refusal instead of retaining old member flags',async()=>{
 await loadSelected();m.channels.mockResolvedValueOnce({ok:true,data:{...page,channels:[{...channel,isMember:false}]}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'More channels'})));
 expect(screen.getByRole('option',{name:'#acceptance · invite Axiom first'})).toHaveProperty('disabled',true);expect(screen.getByLabelText('Bot Slack channel')).toHaveProperty('value','');expect(screen.queryByRole('textbox',{name:'Slack message'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('uses fresh duplicate channel details while retaining the same-boundary draft',async()=>{
 const input=await loadSelected();m.channels.mockResolvedValueOnce({ok:true,data:{...page,channels:[{...channel,name:'renamed'}]}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'More channels'})));
 expect(screen.getByRole('textbox',{name:'Slack message'})).toBe(input);expect(input).toHaveProperty('value','Keep this unsaved exact message');expect(screen.getByText(/Workspace T123456789 · #renamed/)).toBeTruthy();expect(screen.getAllByRole('option')).toHaveLength(2);expect(m.mutate).not.toHaveBeenCalled();
});
it('keeps explicit full channel refresh invalidation unchanged',async()=>{
 await loadSelected();m.channels.mockResolvedValueOnce({ok:true,data:page});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Load Slack channels'})));
 expect(screen.getByLabelText('Bot Slack channel')).toHaveProperty('value','');expect(screen.queryByRole('textbox',{name:'Slack message'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('retains only the current 100-channel page plus the selected target',async()=>{
 const input=await loadSelected(),fullPage=Array.from({length:100},(_,index)=>({id:'CPAGE'+String(index).padStart(3,'0'),name:'page-'+index,isMember:true}));
 m.channels.mockResolvedValueOnce({ok:true,data:{...page,channels:fullPage,nextCursor:'last'}});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'More channels'})));
 expect(screen.getAllByRole('option')).toHaveLength(102);expect(screen.getByRole('textbox',{name:'Slack message'})).toBe(input);expect(input).toHaveProperty('value','Keep this unsaved exact message');expect(m.mutate).not.toHaveBeenCalled();
});
it('does not resurrect a target deliberately cleared while its next page is loading',async()=>{
 await loadSelected();let finish!:(value:unknown)=>void;m.channels.mockReturnValueOnce(new Promise(resolve=>{finish=resolve}));fireEvent.click(screen.getByRole('button',{name:'More channels'}));
 fireEvent.change(screen.getByLabelText('Bot Slack channel'),{target:{value:''}});await act(async()=>finish({ok:true,data:{...page,channels:[other]}}));
 expect(screen.getByLabelText('Bot Slack channel')).toHaveProperty('value','');expect(screen.queryByRole('textbox',{name:'Slack message'})).toBeNull();expect(m.mutate).not.toHaveBeenCalled();
});
it('retains the same composer and text when the next-page read cannot be confirmed',async()=>{
 const input=await loadSelected();m.channels.mockResolvedValueOnce({ok:false,error:'Channel page unavailable'});await act(async()=>fireEvent.click(screen.getByRole('button',{name:'More channels'})));
 expect(screen.getByRole('alert').textContent).toBe('Channel page unavailable');expect(screen.getByRole('textbox',{name:'Slack message'})).toBe(input);expect(input).toHaveProperty('value','Keep this unsaved exact message');expect(m.mutate).not.toHaveBeenCalled();
});
