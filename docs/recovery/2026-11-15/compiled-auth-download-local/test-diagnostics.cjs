const assert=require('node:assert/strict'),{classify}=require('./diagnostics.cjs');
const input='SYNTHETIC_PRIVATE_URL_PASSWORD_COOKIE_QUERY';
for(const error of [Object.assign(Error(input),{code:input,cause:Error(input),query:input,cookie:input}),new TypeError(input),new SyntaxError(input),input])assert(!JSON.stringify(classify(error)).includes(input));
const poisoned={};for(const key of ['code','name','message','cause'])Object.defineProperty(poisoned,key,{get(){throw Error(input)}});assert(!JSON.stringify(classify(poisoned)).includes(input));
assert.deepEqual(classify(Object.assign(Error('compiled_storage_component'),{code:'EACCES',cause:'PCP_007'})),{errorClass:'Error',assertion:'compiled_storage_component',code:'EACCES',causeCode:'PCP_007'});
assert.equal(classify(Object.assign(Error(input),{code:'42P01'})).code,'42P01');
console.log('owned_diagnostic_boundary_pass');
