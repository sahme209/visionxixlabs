export default {
  root: '/private/tmp/axiom-a7-privacy-20261103',
  cacheDir: '/private/tmp/axiom-a7-evidence/cache',
  resolve: { alias: [
    { find: 'server-only', replacement: '/private/tmp/axiom-a7-privacy-20261103/test/serverOnlyStub.ts' },
    { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-a7-privacy-20261103/$1' },
  ] },
  test: { environment: 'node', include: ['app/api/__tests__/persistenceErrorPrivacy.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
