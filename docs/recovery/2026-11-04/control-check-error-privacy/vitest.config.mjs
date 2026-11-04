export default {
  root: '/private/tmp/axiom-a7-control-20261104',
  cacheDir: '/private/tmp/axiom-a7-control-evidence/cache',
  resolve: { alias: [
    { find: 'server-only', replacement: '/private/tmp/axiom-a7-control-20261104/test/serverOnlyStub.ts' },
    { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-a7-control-20261104/$1' },
  ] },
  test: { environment: 'node', include: ['app/api/cron/compliance-control-check/__tests__/errorPrivacy.test.ts', 'app/api/cron/compliance-control-check/__tests__/route.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
