/** Deployment-operator attestation to separately performed isolated-model limit
 * acceptance. This is NOT cryptographic proof or automatic server discovery.
 * Never accept this representation from workspace settings or a model response.
 * Missing live acceptance must leave this operator setting absent. Parsing
 * yields proposed accounting data only; it does not qualify live server limits
 * or authorize dispatch. A trusted acceptance reader/composition is required. */
export function customerHostedAttestedHold(config:{readonly digest:string;readonly models:readonly {readonly id:string;readonly maxInputTokens:number;readonly maxOutputTokens:number}[]},modelId:string,raw:unknown,now:number):number|null {
 try{
  if(typeof raw!=='string'||Buffer.byteLength(raw)>4096||!Number.isSafeInteger(now)||now<0)return null;
  const row:unknown=JSON.parse(raw);
  if(!row||typeof row!=='object'||Array.isArray(row))return null;
  const value=row as Record<string,unknown>,keys=['format','configDigest','modelId','maxInputTokens','maxOutputTokens','expiresAt','evidenceSha256'];
  if(Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))return null;
  const model=config.models.find(m=>m.id===modelId);
  if(!model||value.format!=='axiom.operator-model-limits/1'||value.configDigest!==config.digest||value.modelId!==modelId||value.maxInputTokens!==model.maxInputTokens||value.maxOutputTokens!==model.maxOutputTokens||typeof value.evidenceSha256!=='string'||!/^[a-f0-9]{64}$/.test(value.evidenceSha256))return null;
  if(typeof value.expiresAt!=='string'||new Date(value.expiresAt).toISOString()!==value.expiresAt||Date.parse(value.expiresAt)<=now)return null;
  const hold=model.maxInputTokens+model.maxOutputTokens;
  if(!Number.isSafeInteger(model.maxInputTokens)||model.maxInputTokens<=0||!Number.isSafeInteger(model.maxOutputTokens)||model.maxOutputTokens<=0||!Number.isSafeInteger(hold))return null;
  return hold;
 }catch{return null;}
}
