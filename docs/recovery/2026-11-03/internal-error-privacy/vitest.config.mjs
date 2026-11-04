export default {
  root: '/private/tmp/axiom-session-error-repro-20261103',
  cacheDir: '/private/tmp/axiom-session-error-repro-evidence/cache',
  resolve: { alias: [
    { find: 'server-only', replacement: '/private/tmp/axiom-session-error-repro-20261103/test/serverOnlyStub.ts' },
    { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-session-error-repro-20261103/$1' },
  ] },
  test: { environment: 'node', include: ['app/api/desktop/session/__tests__/errorPrivacy.test.ts', 'lib/api/__tests__/errorDtoPrivacy.test.ts', 'app/api/desktop/session/__tests__/route.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
