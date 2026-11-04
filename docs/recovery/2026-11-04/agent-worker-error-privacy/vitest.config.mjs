export default {
  root: '/private/tmp/axiom-a7-worker-20261104',
  cacheDir: '/private/tmp/axiom-a7-worker-evidence/cache',
  resolve: { alias: [
    { find: 'server-only', replacement: '/private/tmp/axiom-a7-worker-20261104/test/serverOnlyStub.ts' },
    { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-a7-worker-20261104/$1' },
  ] },
  test: { environment: 'node', include: ['app/api/agents/run/__tests__/errorPrivacy.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
