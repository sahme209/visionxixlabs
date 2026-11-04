export default {
 root: '/private/tmp/axiom-docs-current-page-20261104',
 cacheDir: '/private/tmp/axiom-docs-current-page-evidence/cache',
 resolve: { dedupe: ['react', 'react-dom'], alias: [
  { find: 'server-only', replacement: '/private/tmp/axiom-docs-current-page-20261104/test/serverOnlyStub.ts' },
  { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-docs-current-page-20261104/$1' },
 ] },
 esbuild: { jsx: 'automatic' },
 test: { environment: 'node', include: ['app/docs/__tests__/guide-navigation-search.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
