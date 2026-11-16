'use strict';
const fs=require('node:fs'),path=require('node:path'),P=__dirname,proposal='/private/tmp/v19-google-production-history-apply-proposal';
const apply=JSON.parse(fs.readFileSync(proposal+'/APPLY-TOOL-ARGS.json','utf8')),verify=JSON.parse(fs.readFileSync(proposal+'/VERIFY-TOOL-ARGS.json','utf8'));
for(const [name,value] of [['APPLY-TOOL-ARGS.json',apply],['VERIFY-TOOL-ARGS.json',verify]])fs.writeFileSync(path.join(P,name),JSON.stringify(value,null,2)+'\n');
const core=fs.readFileSync(path.join(P,'core.cjs'),'utf8').replace(/module.exports=.+;\n?$/,'');
const guards=[...new Set(apply.sql_statements.flatMap(sql=>[...sql.matchAll(/RAISE EXCEPTION '(GIM_[0-9]{3}_[a-z0-9_]+)'/g)].map(x=>x[1])))];
const body=`const KNOWN_GUARDS=${JSON.stringify(guards)};\nconst key='v19-google-identity-exact-production-apply-and-verify-v1';
if(load(key)){text({verified:false,reason:'attempt_consumed'})}else{
 let stage='apply_call',attemptedToolInvocations=0,applyResponseVerified=false,verification,applyDiagnostic;
 const snapshot=()=>({stage,attemptedToolInvocations,applyResponseVerified,...(applyDiagnostic?{applyDiagnostic}:{}),...(verification?{verification}:{})});
 const save=()=>store(key,{consumed:true,...snapshot()});save();
 try{attemptedToolInvocations=1;save();const raw=await tools.mcp__codex_apps__neon_run_sql_transaction(${JSON.stringify(apply)});applyDiagnostic=diagnostic(raw,KNOWN_GUARDS);stage='apply_decode';save();applyAck(raw);applyResponseVerified=true;stage='apply_response_verified';save()}catch(error){if(!applyDiagnostic)applyDiagnostic=diagnostic(error,KNOWN_GUARDS);stage='apply_response_uncertain';save()}
 try{stage='verify_call';attemptedToolInvocations=2;save();const raw=await tools.mcp__codex_apps__neon_run_sql_transaction(${JSON.stringify(verify)});stage='verify_decode';save();verification=verifyFacts(raw);stage='complete';save();text({verified:applyResponseVerified&&applied(verification),...snapshot(),productionDeploymentAuthorized:false,noFurtherCalls:true})}catch{stage='verification_unavailable';save();text({verified:false,reason:'verification_unavailable',...snapshot(),productionDeploymentAuthorized:false,noFurtherCalls:true})}
}`;
fs.writeFileSync(path.join(P,'coordinator.js.txt'),core+'\n'+body+'\n');
