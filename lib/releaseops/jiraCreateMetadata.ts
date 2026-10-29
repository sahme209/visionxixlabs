import { z } from "zod";

// Jira Cloud's paged create-field metadata. This is a read-only projection,
// not a form encoder, permission grant or authority to create an issue.
// https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-createmeta-projectidorkey-issuetypes-issuetypeid-get
const identifier = z.string().min(1).max(128).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
  .refine(value => !["__proto__", "constructor", "prototype"].includes(value));
const providerField = z.object({
  fieldId: identifier,
  key: identifier.optional(),
  name: z.string().min(1).max(512).refine(value => value.trim().length > 0),
  required: z.boolean(),
  hasDefaultValue: z.boolean(),
  operations: z.array(z.string().min(1).max(64)).max(25),
  schema: z.object({ type: z.string().min(1).max(128), system:z.string().min(1).max(128).optional(), custom:z.string().min(1).max(256).optional() }).optional(),
}).refine(field => field.key === undefined || field.key === field.fieldId);
const metadataPages = z.array(z.object({
  fields: z.array(providerField).max(200),
  startAt: z.number().int().min(0).max(200),
  total: z.number().int().min(0).max(200),
  maxResults: z.number().int().min(1).max(200),
})).min(1).max(10);

export interface JiraDiscoveredCreateField {
  id: string;
  name: string;
  required: boolean;
  hasDefaultValue: boolean;
  canSet: boolean;
  schemaType: string | null;
  schemaSystem?:string;
  schemaCustom?:string;
}

/** Refuse incomplete discovery rather than silently dropping a required field. */
export function collectJiraCreateMetadata(input: unknown): {
  authority: "discovery_only";
  fields: JiraDiscoveredCreateField[];
} {
  const parsed = metadataPages.safeParse(input);
  if (!parsed.success) throw new Error("Jira create metadata is invalid or exceeds supported bounds");
  const pages = parsed.data;
  const total = pages[0].total;
  const fields: JiraDiscoveredCreateField[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (page.total !== total || page.startAt !== fields.length || page.fields.length > page.maxResults ||
      fields.length + page.fields.length > total || (page.fields.length === 0 && total !== 0))
      throw new Error("Jira create metadata pages are incomplete or inconsistent");
    for (const field of page.fields) {
      if (seen.has(field.fieldId)) throw new Error("Jira create metadata contains duplicate fields");
      seen.add(field.fieldId);
      fields.push({ id: field.fieldId, name: field.name, required: field.required,
        hasDefaultValue: field.hasDefaultValue, canSet: field.operations.includes("set"),
        schemaType: field.schema?.type ?? null, ...(field.schema?.system===undefined?{}:{schemaSystem:field.schema.system}), ...(field.schema?.custom===undefined?{}:{schemaCustom:field.schema.custom}) });
    }
  }
  if (fields.length !== total || (total === 0 && pages.length !== 1))
    throw new Error("Jira create metadata pages are incomplete or inconsistent");
  return { authority: "discovery_only", fields };
}
