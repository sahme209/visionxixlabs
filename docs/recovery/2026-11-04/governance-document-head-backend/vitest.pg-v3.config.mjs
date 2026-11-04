export default {
  "root": "/private/tmp/axiom-a2-document-head-backend-20261104",
  "cacheDir": "/private/tmp/axiom-a2-document-head-evidence/cache",
  "resolve": {
    "alias": {
      "server-only": "/private/tmp/axiom-a2-document-head-backend-20261104/test/serverOnlyStub.ts",
      "@": "/private/tmp/axiom-a2-document-head-backend-20261104"
    }
  },
  "test": {
    "environment": "node",
    "include": [
      "lib/governance/intelligence/__tests__/requestService.pg.test.ts"
    ],
    "cache": false,
    "maxWorkers": 1,
    "minWorkers": 1,
    "fileParallelism": false
  }
};
