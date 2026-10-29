// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {render,screen,cleanup} from '@testing-library/react';
const mocks=vi.hoisted(()=>({status:'owner_only'}));
vi.mock('../../desktop/src/lib/outlookTransport',()=>({outlookRequest:async()=>({ok:true,data:mocks.status==='reconnect_required'?{state:mocks.status,account:{id:'mailbox',displayName:'Owner',email:'owner@example.com'},binding:{},actionConsent:true,expiresAt:'2030-01-01T00:00:00Z'}:{state:mocks.status}})}));
vi.mock('../../desktop/src/components/OutlookActionsPanel',()=>({OutlookActionsPanel:()=>createElement('div',null,'Independent Outlook review controls')}));
vi.mock('../../desktop/src/components/CatalogIcon',()=>({ProviderLogo:()=>null}));
vi.mock('../../desktop/src/lib/desktopClient',()=>({desktopClient:{config:{apiBase:'https://visionxixlabs.com',sessionToken:'axm.desk.fixture'},getContextRevision:()=>1,subscribeContext:()=>()=>{}}}));
import {OutlookIntegrationCard} from '../../desktop/src/components/OutlookIntegrationCard';
afterEach(cleanup);
it.each(['owner_only','reconnect_required','needs_attention','not_connected'])('keeps independent reviews and historical recovery reachable when mailbox state is %s',async state=>{mocks.status=state;render(createElement(OutlookIntegrationCard));expect(await screen.findByText('Independent Outlook review controls')).toBeTruthy();expect(screen.queryByRole('button',{name:'Read mailbox context'})).toBeNull()});
