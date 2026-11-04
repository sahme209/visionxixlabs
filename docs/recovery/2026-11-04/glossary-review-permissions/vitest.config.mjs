export default {
  root: '/private/tmp/axiom-b4-glossary-20261104',
  cacheDir: '/private/tmp/axiom-b4-glossary-evidence/cache',
  resolve: { dedupe: ['react', 'react-dom'], alias: [
    { find: 'server-only', replacement: '/private/tmp/axiom-b4-glossary-20261104/test/serverOnlyStub.ts' },
    { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-b4-glossary-20261104/$1' },
  ] },
  esbuild: { jsx: "automatic" },
  test: { environment: 'node', include: ['app/docs/glossary/__tests__/reviewDefinitions.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
