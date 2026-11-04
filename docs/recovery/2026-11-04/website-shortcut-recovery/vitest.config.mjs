export default {
  root: '/private/tmp/axiom-b2b6-keys-20261104',
  cacheDir: '/private/tmp/axiom-b2b6-keys-evidence/cache',
  resolve: { dedupe: ['react', 'react-dom'], alias: [
    { find: 'server-only', replacement: '/private/tmp/axiom-b2b6-keys-20261104/test/serverOnlyStub.ts' },
    { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-b2b6-keys-20261104/$1' },
  ] },
  esbuild: { jsx: "automatic" },
  test: { environment: 'node', include: ['components/marketing/__tests__/ModifiedNavigation.focused.test.ts', 'components/marketing/__tests__/WorkflowEvidenceMap.focused.test.ts', 'components/marketing/__tests__/WorkflowStories.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
