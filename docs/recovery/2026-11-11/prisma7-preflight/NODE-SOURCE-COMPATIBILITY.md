# Native Node source compatibility — local, not deployed

The prior actual Node 24 import refused with ERR_MODULE_NOT_FOUND on the extensionless client facade. The facade now resolves the emitted CommonJS `.js` client and the erasable factory source uses explicit `.ts` imports. An actual Node 24 import with socket access replaced by a throwing guard constructed the missing-target client and verified its fixed query refusal. No connection was attempted.

The root config adds only `allowImportingTsExtensions: true` under the existing `noEmit: true`. Independent source review found no important findings; strictness, exclusions and module resolution remain unchanged. Only after that review was the exact `tsconfig.json` source pin updated in `ownedWebsiteFramework.cjs`. Historical recovery bindings are unchanged. Standalone emitters that preserve `.ts` imports still require separate qualification.

Eleven ordinary script sources (15 constructors) now use the common adapter factory with the exact same explicit target expressions, or DATABASE_URL where the previous bare constructor used environment configuration. Existing target guards and operations are unchanged. These scripts were NOT executed: several perform writes. Source changes grant no permission to run them. Native source loading requires the reviewed Node 24 tooling; production runtime compatibility remains a deployment gate.

An actual pg Client construction test, with hostile synthetic ambient PG variables, verifies explicit host/user/database, empty password callback, public search path and certificate verification. It makes no connection. Database-focused tests: 24 passed; root native types passed. Broader suite is tracked separately.

Driver differences requiring explicit compatibility review: default maximum pool size is 10 (not the old engine's CPU-derived value); finite connection wait uses the tighter supplied connect/pool timeout; strict channel_binding=require is refused because this driver only offers opportunistic channel binding. No exact behavioral equivalence or production URL compatibility is claimed. No production setting was decrypted or changed.
