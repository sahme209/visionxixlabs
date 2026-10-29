import {it,expect} from 'vitest';
import {parseDesktopIdentityResponse} from '../../../desktop/src/lib/desktopIdentityResponse';
const access={allowed:true,code:'active',title:'Active',message:'Ready',planTier:'pro',billingStatus:'active',accessRequestPath:'/access',pricingPath:'/pricing'};
const data=(extra:Record<string,unknown>={})=>({identity:{kind:'desktop_session',organizationId:'org',capabilities:[],...extra},access});
it('retains an optional authenticated desktop user ID for recovery without requiring it on older services',()=>{expect(parseDesktopIdentityResponse(data({userId:'user-1'}))?.userId).toBe('user-1');expect(parseDesktopIdentityResponse(data())?.userId).toBeUndefined()});
it('refuses malformed or API-key user identities instead of deriving a recovery owner',()=>{for(const userId of ['', ' user ', 'x\n', 'x'.repeat(241),123])expect(parseDesktopIdentityResponse(data({userId}))).toBeNull();expect(parseDesktopIdentityResponse(data({kind:'api_key',userId:'key-owner'}))).toBeNull()});
