/** @vitest-environment jsdom */
import {createElement} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
const f=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('../../../desktop/src/lib/outlookTransport',()=>({outlookRequest:f.read}));
vi.mock('../../../desktop/src/lib/desktopClient',()=>({desktopClient:{config:{},getContextRevision:()=>0,subscribeContext:()=>()=>{}}}));
vi.mock('../../../desktop/src/components/OutlookActionsPanel',()=>({OutlookActionsPanel:()=>null}));
vi.mock('@tauri-apps/plugin-shell',()=>({open:vi.fn()}));
import {OutlookIntegrationCard} from '../../../desktop/src/components/OutlookIntegrationCard';
afterEach(cleanup);
it('recovers from an unexpected rejected transport without leaking details or an unhandled rejection',async()=>{f.read.mockRejectedValueOnce(Error('PRIVATE credential')).mockResolvedValueOnce({ok:true,data:{state:'not_connected'}});render(createElement(OutlookIntegrationCard));expect((await screen.findByRole('alert')).textContent).toContain('Outlook status could not be verified. Refresh status to try again.');expect(screen.queryByText('PRIVATE credential')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Refresh status'}));expect(await screen.findByText('Not connected')).toBeTruthy();expect(f.read).toHaveBeenCalledTimes(2)});
