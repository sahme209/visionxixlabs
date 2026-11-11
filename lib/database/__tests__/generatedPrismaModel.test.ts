import { expect, it } from 'vitest';
import { generatedPrismaModel, matchingGeneratedDatamodel } from './fixtures/generatedPrismaModel';
const schema = 'datasource db {\n provider = "postgresql"\n}\nmodel Example {\n id String @id\n required String\n}\n';
it('reads the actual generated model and rejects absent models', async () => {
  const model = await generatedPrismaModel('DurableAgentWorkflow');
  expect(model.fields.find(field => field.name === 'organizationId')).toMatchObject({ isRequired: true, hasDefaultValue: false });
  await expect(generatedPrismaModel('DefinitelyMissing')).rejects.toThrow('generated_prisma_model_missing');
});
it('detects a newly required field missing from generated metadata', async () => {
  const changed = schema.replace('required String', 'required String\n added String');
  await expect(matchingGeneratedDatamodel(schema, changed)).rejects.toThrow('generated_prisma_schema_stale');
  expect((await matchingGeneratedDatamodel(changed, changed)).models[0].fields.find(field => field.name === 'added')).toMatchObject({ isRequired: true, hasDefaultValue: false });
});
