'use strict';
// Fixed categories only. Raw child output is never returned or logged.
function isolatedNextStartupCategories(value) {
 if(typeof value!=='string'||value.length>65536)return{status:'unavailable',categories:[]};
 const patterns={
  module_missing:/ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|Cannot find module|Module not found/,
  esm_loading:/ERR_REQUIRE_ESM|ERR_REQUIRE_ASYNC_MODULE|Cannot use import statement|require is not defined|exports is not defined|__dirname is not defined/,
  typescript_options:/TS[0-9]{4}|Invalid compiler option|allowImportingTsExtensions/,
  child_guard:/owned_test_child_options_unsupported|owned_checkout_launch_policy_unsupported|owned_framework_source_pins/,
  transport_guard:/owned_.*(?:transport|network|request).*?(?:denied|refused|unavailable)/,
  prisma_initialization:/PrismaClientInitializationError|PrismaClientConstructorValidationError|database_configuration_unavailable/,
  generated_prisma:/generated[\\/]prisma[\\/]client|prismaClient\.ts/,
  address_conflict:/EADDRINUSE/,
  permission:/EACCES|EPERM/,
  syntax_error:/SyntaxError/,
  type_error:/TypeError/,
 };
 const categories=Object.entries(patterns).filter(([,pattern])=>pattern.test(value)).map(([name])=>name);
 const requests=new Map([
  ['@prisma/client','missing_prisma_package'],['.prisma/client/default','missing_legacy_prisma_client'],
  ['@prisma/client/runtime/client','missing_prisma_runtime'],['@prisma/client/runtime/client.js','missing_prisma_runtime'],
  ['@prisma/client/runtime/query_compiler_fast_bg.postgresql.js','missing_prisma_compiler'],
  ['@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm','missing_prisma_wasm'],
  ['@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.js','missing_prisma_wasm'],
  ['./internal/class.js','missing_generated_class'],['./internal/prismaNamespace.js','missing_generated_namespace'],
  ['@prisma/adapter-pg','missing_prisma_adapter'],['pg','missing_pg'],['typescript','missing_typescript'],
  ['@typescript/native','missing_native_typescript'],['@typescript/native-preview','missing_native_typescript'],['server-only','missing_server_only'],
 ]);
 const observations=[];
 for(const match of value.matchAll(/(?:Cannot find module|Can't resolve)\s+['"]([^'"\r\n]{1,512})['"]/g)){observations.push(match);if(observations.length===16)break;}
 for(const match of observations){
  const token=match[1];let category=requests.get(token);
  if(!category&&token.endsWith('/vitest/suppress-warnings.cjs'))category='missing_fixture_warning_preload';
  if(!category&&token.endsWith('/fonts.cjs'))category='missing_fixture_font_mock';
  if(!category&&/\/\.next\/(?:dev\/)?server\/vendor-chunks\//.test(token))category='missing_next_vendor_chunk';
  if(!category&&/\/\.next\/(?:dev\/)?server\/app\//.test(token))category='missing_next_route_chunk';
  if(!category&&token.endsWith('/webpack-runtime.js'))category='missing_next_webpack_runtime';
  if(!categories.includes(category??'missing_module_unknown'))categories.push(category??'missing_module_unknown');
 }
 return{status:'observed',categories};
}
module.exports=Object.freeze({isolatedNextStartupCategories});
