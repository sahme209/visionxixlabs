'use strict';
try {
if(process.platform!=='darwin'||process.arch!=='arm64'||process.version!=='v24.21.0')throw Error('unexpected_runtime');
const moduleValue=require("/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-detached-query-compat-3/query-review-copy.node");
if(typeof moduleValue.QueryEngine!=='function')throw Error('unexpected_export');
process.stdout.write('AXIOM_QUERY_MODULE_LOADED_NO_ENGINE\n');process.exit(0);
}catch(error){let category='load_refused';
if(error&&typeof error.message==='string'&&/code signature|different Team IDs|library validation/i.test(error.message))category='library_validation_refused';
else if(error&&error.code==='ERR_DLOPEN_FAILED')category='native_loader_refused';
else if(error&&error.message==='unexpected_runtime')category='runtime_mismatch';
else if(error&&error.message==='unexpected_export')category='export_mismatch';
process.stdout.write('AXIOM_QUERY_LOAD_REFUSED '+category+'\n');process.exit(73);}
