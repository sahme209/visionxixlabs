import { readFile } from 'node:fs/promises';
import { getDMMF } from '@prisma/internals';
import { PrismaClient } from '@/lib/prismaClient';

/** Compare full metadata, not a hand-maintained required-field list. No queries. */
export async function matchingGeneratedDatamodel(generated: string, source: string) {
  const [actual, current] = await Promise.all([
    getDMMF({ datamodel: generated }), getDMMF({ datamodel: source }),
  ]);
  if (JSON.stringify(actual.datamodel) !== JSON.stringify(current.datamodel)) {
    throw new Error('generated_prisma_schema_stale');
  }
  return actual.datamodel;
}

let metadata: ReturnType<typeof matchingGeneratedDatamodel> | undefined;
export async function generatedPrismaModel(name: string) {
  metadata ??= (async () => {
    const client = new PrismaClient({ adapter: {
      provider: 'postgres', adapterName: 'metadata-only',
      async connect() { throw new Error('metadata_query_forbidden'); },
    } });
    try {
      const config: unknown = Reflect.get(client, '_engineConfig');
      const schema: unknown = config && typeof config === 'object'
        ? Reflect.get(config, 'inlineSchema') : undefined;
      if (typeof schema !== 'string' || schema.length === 0 || schema.length > 2_000_000) {
        throw new Error('generated_prisma_metadata_unavailable');
      }
      return await matchingGeneratedDatamodel(schema, await readFile('prisma/schema.prisma', 'utf8'));
    } finally {
      await client.$disconnect();
    }
  })();
  const model = (await metadata).models.find(model => model.name === name);
  if (!model) throw new Error('generated_prisma_model_missing');
  return model;
}
