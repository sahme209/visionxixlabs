import {activeCustomerHostedBudget,readInstallationAIMode,parseCustomerHostedOperatorConfig,type CustomerHostedOperatorConfig,type InstallationAIMode} from './customerHostedConfig';
import {readAcceptedCustomerHostedLimits} from './customerHostedLimitSupplier';
export interface CustomerHostedAvailability {mode:InstallationAIMode;models:Array<{id:string;label:string;tier:'balanced'}>}
/** Configuration/acceptance discovery only, not an execution grant or token
 * availability claim. No server request, endpoint or cap leaves this boundary. */
export async function customerHostedAvailability(organizationId:string,deps:{readConfig?:()=>CustomerHostedOperatorConfig|null;readLimits?:typeof readAcceptedCustomerHostedLimits;now?:()=>number}={}):Promise<CustomerHostedAvailability>{
 const mode=readInstallationAIMode(process.env.AXIOM_OFFLINE_MODE);if(mode!=='offline')return {mode,models:[]};
 try{
  const readConfig=deps.readConfig??(()=>parseCustomerHostedOperatorConfig(process.env.AXIOM_LOCAL_MODEL_CONFIG)),clock=deps.now??Date.now,config=readConfig();
  if(!config||!activeCustomerHostedBudget(config,organizationId,clock()))return {mode,models:[]};
  const candidates:Array<{id:string;label:string;tier:'balanced';expiresAt:number}>=[];
  // Sequential bounded local reads avoid a burst of native metadata processes.
  for(const model of config.models){
   const accepted=await (deps.readLimits??readAcceptedCustomerHostedLimits)(config,model.id,clock()).catch(()=>null);
   if(accepted&&accepted.expiresAt>clock()&&accepted.reservedTokens===model.maxInputTokens+model.maxOutputTokens)candidates.push({id:model.id,label:model.id,tier:'balanced',expiresAt:accepted.expiresAt});
  }
  if(readInstallationAIMode(process.env.AXIOM_OFFLINE_MODE)!=='offline'||readConfig()?.digest!==config.digest||!activeCustomerHostedBudget(config,organizationId,clock()))return {mode:'unavailable',models:[]};
  const finalNow=clock();
  return {mode,models:candidates.filter(model=>model.expiresAt>finalNow).map(({expiresAt:_expires,...model})=>model)};
 }catch{return {mode:'unavailable',models:[]};}
}
