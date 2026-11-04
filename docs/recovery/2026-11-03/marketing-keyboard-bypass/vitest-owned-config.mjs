export default {
  cacheDir: '/private/tmp/axiom-marketing-keyboard-bypass-4de6/.keyboard-vitest-cache',
  resolve: { dedupe: ['react', 'react-dom'] },
  test: { environment: 'node', include: ['components/**/__tests__/**/*.test.ts'], globals: false },
};
