export default {
 root: '/private/tmp/axiom-b6-installer-copy-20261104',
 cacheDir: '/private/tmp/axiom-b6-installer-copy-evidence/cache',
 resolve: { dedupe: ['react', 'react-dom'], alias: [
  { find: 'server-only', replacement: '/private/tmp/axiom-b6-installer-copy-20261104/test/serverOnlyStub.ts' },
  { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-b6-installer-copy-20261104/$1' },
 ] },
 esbuild: { jsx: 'automatic' },
 test: { environment: 'node', include: ['app/download/preview/__tests__/availabilityBoundary.test.ts', 'lib/desktop/__tests__/desktopRuntimeReadiness.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
