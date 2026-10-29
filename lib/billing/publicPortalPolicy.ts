import "server-only";
const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
/** Version one never allows the portal to charge a changed plan/seat quantity
 * which the immutable contract cannot fulfill. Existing other-product portal
 * configurations are neither reused nor modified. */
export function assertPublicPortalConfiguration(value:unknown,id:string,livemode:boolean):void{
  const c=object(value),features=object(c.features),update=object(features.subscription_update),cancel=object(features.subscription_cancel),payment=object(features.payment_method_update);
  if(!id.startsWith('bpc_')||c.id!==id||c.active!==true||c.livemode!==livemode||update.enabled!==false||cancel.enabled!==true||cancel.mode!=='at_period_end'||payment.enabled!==true)throw Error('public_portal_configuration_unverified');
}
