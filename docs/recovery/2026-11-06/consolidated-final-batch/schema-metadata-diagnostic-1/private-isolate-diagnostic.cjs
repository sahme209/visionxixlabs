'use strict';
// Root invokes only after conditional approval AND independent frozen-source review.
// No import/IO/logging. Raw provider response never leaves this same private isolate.
let attempted=false;
async function runApprovedMetadataDiagnostic(tools,projector){
 if(attempted)throw Error('diagnostic_attempt_already_consumed');
 attempted=true;let response=null;
 try{
  response=await tools.mcp__codex_apps__vercel_filter_project_envs({idOrName:'prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp',teamId:'team_j0CEiAAorasdEVQyeAJjpNfm',decrypt:'false'});
  return projector.projectMetadataDiagnostic(response);
 }catch{return projector.projectMetadataDiagnostic(null,true);}
 finally{response=null;}
}
module.exports=Object.freeze({runApprovedMetadataDiagnostic});
