import {describe,expect,it} from 'vitest';
import {assertPublicPortalConfiguration} from '../publicPortalPolicy';
function config(){return {id:'bpc_fixture',active:true,livemode:false,features:{subscription_update:{enabled:false},subscription_cancel:{enabled:true,mode:'at_period_end'},payment_method_update:{enabled:true}}};}
describe('public customer portal policy',()=>{
 it('permits payment method repair and period-end cancellation without changing purchased terms',()=>{expect(()=>assertPublicPortalConfiguration(config(),'bpc_fixture',false)).not.toThrow();});
 it.each([(c:ReturnType<typeof config>)=>{c.features.subscription_update.enabled=true;}, (c:ReturnType<typeof config>)=>{c.features.subscription_cancel.mode='immediately';}, (c:ReturnType<typeof config>)=>{c.features.subscription_cancel.enabled=false;}, (c:ReturnType<typeof config>)=>{c.livemode=true;}, (c:ReturnType<typeof config>)=>{c.id='bpc_other';}])('rejects configuration that can charge unsupported terms or cross mode (%#)',change=>{const c=config();change(c);expect(()=>assertPublicPortalConfiguration(c,'bpc_fixture',false)).toThrow();});
});
