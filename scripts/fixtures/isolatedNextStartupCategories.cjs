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
 return{status:'observed',categories:Object.entries(patterns).filter(([,pattern])=>pattern.test(value)).map(([name])=>name)};
}
module.exports=Object.freeze({isolatedNextStartupCategories});
