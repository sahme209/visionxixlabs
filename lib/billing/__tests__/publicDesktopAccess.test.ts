import {describe,expect,it} from 'vitest';
import {decideDesktopCommercialAccess} from '@/lib/desktop/desktopCommercialAccessPolicy';
describe('public subscription desktop access',()=>{
 it('allows verified Free access without inventing a Stripe subscription',()=>{expect(decideDesktopCommercialAccess({tier:'trial',status:'active',publicPlanId:'free',pricingPlanAvailable:true})).toMatchObject({allowed:true,code:'active'});});
 it.each(['past_due','canceled','no_plan'])('denies paid %s without affecting identity or billing recovery',status=>{expect(decideDesktopCommercialAccess({tier:'growth',status,publicPlanId:'pro',pricingPlanAvailable:false})).toMatchObject({allowed:false,pricingPath:'/plans'});});
 it('preserves explicitly legacy access semantics',()=>{expect(decideDesktopCommercialAccess({tier:'growth',status:'past_due'})).toMatchObject({allowed:true});});
});

it('denies unavailable billing authority even when storage cannot identify the public plan',()=>{
 expect(decideDesktopCommercialAccess({tier:'trial',status:'no_plan',pricingPlanAvailable:false})).toMatchObject({allowed:false,code:'production_access_required',accessRequestPath:'/control/usage-billing'});
});
