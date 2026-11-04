export default {
  root: '/private/tmp/axiom-a7-airflow-public-error-20261103',
  cacheDir: '/private/tmp/axiom-a7-airflow-evidence/cache',
  resolve: { alias: [
    { find: 'server-only', replacement: '/private/tmp/axiom-a7-airflow-public-error-20261103/test/serverOnlyStub.ts' },
    { find: /^@\/(.*)$/, replacement: '/private/tmp/axiom-a7-airflow-public-error-20261103/$1' },
  ] },
  test: { environment: 'node', include: ['app/api/desktop/airflow/dags/__tests__/errorPrivacy.test.ts', 'lib/integrations/airflow/__tests__/publicError.test.ts'], cache: false, maxWorkers: 1, minWorkers: 1, fileParallelism: false },
};
