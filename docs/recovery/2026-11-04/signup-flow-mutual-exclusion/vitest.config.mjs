export default {
 root: '/private/tmp/axiom-a4-signup-guard-20261104',
 cacheDir: '/private/tmp/axiom-a4-signup-guard-evidence/cache',
 resolve: { dedupe: ['react', 'react-dom'], alias: [
  { find: 'server-only', replacement: '/private/tmp/axiom-a4-signup-guard-20261104/test/serverOnlyStub.ts' },
  { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-a4-signup-guard-20261104/$1' },
 ] },
 esbuild: { jsx: 'automatic' },
 test: { environment: 'node', include: ['app/auth/signup/__tests__/overlappingFlows.test.ts', 'app/auth/signup/__tests__/verificationHandoff.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
