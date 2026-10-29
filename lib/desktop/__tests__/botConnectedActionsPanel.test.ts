/** @vitest-environment jsdom */
import {createElement} from 'react';import {it,expect,vi,afterEach} from 'vitest';import {render,screen,fireEvent,cleanup,act} from '@testing-library/react';
const m=vi.hoisted(()=>({channels:vi.fn(),connected:vi.fn(),slack:vi.fn()}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{listSlackChannels:m.channels}}));
vi.mock('../../../desktop/src/components/ConnectedActionsPanel',()=>({ConnectedActionsPanel:(p:any)=>{m.connected(p);return createElement('div',null,'Existing governed actions')}}));
vi.mock('../../../desktop/src/components/SlackNotificationPanel',()=>({SlackNotificationPanel:(p:any)=>{m.slack(p);return createElement('div',null,'Existing governed Slack')}}));
import {BotConnectedActionsPanel} from '../../../desktop/src/components/BotConnectedActionsPanel';
const sourceTask={taskId:'bot_'+'a'.repeat(64),expectedVersion:2};afterEach(()=>{cleanup();vi.clearAllMocks()});
it('reuses the existing governed executor panel with exact saved-task binding and no auto action',()=>{render(createElement(BotConnectedActionsPanel,{provider:'linear',sourceTask,canManage:true,onClose:vi.fn()}));expect(m.connected).toHaveBeenCalledWith(expect.objectContaining({provider:'linear',sourceTask,canManage:true}));expect(m.channels).not.toHaveBeenCalled()});
it('loads channels only on explicit request and passes the selected target plus task to the existing composer',async()=>{
 m.channels.mockResolvedValue({ok:true,data:{workspaceId:'T123456789',connectionVersion:'2030-01-01T00:00:00.000Z',channels:[{id:'C123456789',name:'acceptance',isMember:true},{id:'C987654321',name:'other',isMember:false}]}});
 render(createElement(BotConnectedActionsPanel,{provider:'slack',sourceTask,canManage:true,onClose:vi.fn()}));expect(m.channels).not.toHaveBeenCalled();expect(m.slack).toHaveBeenLastCalledWith(expect.objectContaining({sourceTask,reviewOnly:true}));await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Load Slack channels'})));expect(screen.getByRole('option',{name:'#other · invite Axiom first'})).toHaveProperty('disabled',true);fireEvent.change(screen.getByLabelText('Bot Slack channel'),{target:{value:'C123456789'}});expect(m.slack).toHaveBeenLastCalledWith(expect.objectContaining({sourceTask,workspaceId:'T123456789',channel:{id:'C123456789',name:'acceptance',isMember:true}}));
});
it('keeps target discovery unavailable to a reviewer without management authority',()=>{render(createElement(BotConnectedActionsPanel,{provider:'slack',sourceTask,canManage:false,onClose:vi.fn()}));expect(screen.queryByRole('button',{name:'Load Slack channels'})).toBeNull();expect(m.channels).not.toHaveBeenCalled()});
