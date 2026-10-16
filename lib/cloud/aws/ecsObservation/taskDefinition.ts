import "server-only";
import { evidenceDigest } from "@/lib/releaseops/ecsReleaseV2/contract";
import definition from "./taskDefinitionSchema.json";
export const TASK_DIGEST_SCHEMA = "axiom.ecs.taskdef.registration.v1" as const;
type Schema = string | {
    ref: string;
} | {
    array: Schema;
} | {
    map: Schema;
} | {
    enum: string[];
} | {
    literal: string;
} | {
    union: Schema[];
} | {
    fields: Record<string, {
        schema: Schema;
        optional: boolean;
    }>;
};
const definitions = definition.definitions as unknown as Record<string, Schema>;
function invalid(): never { throw new Error("task_definition_observation_unavailable"); }
function validate(value: unknown, schema: Schema, depth = 0): unknown {
    if (depth > 30)
        invalid();
    if (typeof schema === "string") {
        if (typeof value !== schema || (typeof value === 'number' && !Number.isFinite(value)) || (typeof value === 'string' && value.length > 65536))
            invalid();
        return value;
    }
    if ('ref' in schema)
        return validate(value, definitions[schema.ref], depth + 1);
    if ('enum' in schema) {
        if (typeof value !== 'string' || !schema.enum.includes(value))
            invalid();
        return value;
    }
    if ('literal' in schema) {
        if (value !== schema.literal)
            invalid();
        return value;
    }
    if ('union' in schema) {
        for (const option of schema.union) {
            try {
                return validate(value, option, depth + 1);
            }
            catch { }
        }
        return invalid();
    }
    if ('array' in schema) {
        if (!Array.isArray(value) || value.length > 100)
            invalid();
        return value.map(v => validate(v, schema.array, depth + 1));
    }
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype)
        invalid();
    const object = value as Record<string, unknown>, result: Record<string, unknown> = Object.create(null);
    if ('map' in schema) {
        if (Object.keys(object).length > 100)
            invalid();
        for (const key of Object.keys(object).sort()) {
            if (key.length > 1024)
                invalid();
            result[key] = validate(object[key], schema.map, depth + 1);
        }
        return result;
    }
    for (const key of Object.keys(object)) {
        if (!Object.hasOwn(schema.fields, key))
            invalid();
    }
    for (const key of Object.keys(schema.fields).sort()) {
        const rule = schema.fields[key];
        if (object[key] === undefined) {
            if (!rule.optional)
                invalid();
            continue;
        }
        result[key] = validate(object[key], rule.schema, depth + 1);
    }
    return result;
}
export interface ObservedTaskPin {
    arn: string;
    digestSchema: typeof TASK_DIGEST_SCHEMA;
    contentDigest: string;
    images: {
        container: string;
        image: string;
    }[];
}
export function projectTaskDefinition(input: unknown): ObservedTaskPin {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        invalid();
    const raw = input as Record<string, unknown>;
    const excluded = new Set(['taskDefinitionArn', 'revision', 'status', 'compatibilities', 'requiresAttributes', 'registeredAt', 'registeredBy', 'deregisteredAt', 'deleteRequestedAt']);
    const registration = Object.fromEntries(Object.entries(raw).filter(([key]) => !excluded.has(key)));
    const projected = validate(registration, definitions.RegisterTaskDefinitionRequest) as Record<string, unknown>;
    if (typeof raw.taskDefinitionArn !== 'string' || !/^arn:(aws|aws-us-gov|aws-cn):ecs:[a-z0-9-]+:\d{12}:task-definition\/[A-Za-z0-9_-]+:[1-9]\d*$/.test(raw.taskDefinitionArn) || raw.status !== 'ACTIVE')
        invalid();
    const identity = /task-definition\/([^:]+):([1-9][0-9]*)$/.exec(raw.taskDefinitionArn);
    if (!identity || projected.family !== identity[1] || !Number.isSafeInteger(raw.revision) || (raw.revision as number) < 1 || !Number.isSafeInteger(Number(identity[2])) || raw.revision !== Number(identity[2]))
        invalid();
    const containers = projected.containerDefinitions as Record<string, unknown>[];
    if (!containers?.length || containers.length > 10)
        invalid();
    const names = new Set<string>();
    const images = containers.map(c => {
        if (typeof c.name !== 'string' || !c.name || names.has(c.name) || typeof c.image !== 'string' || !/^\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(c.image))
            invalid();
        names.add(c.name);
        return { container: c.name, image: c.image };
    });
    function uniqueCollections(value: unknown): void {
        if (Array.isArray(value)) {
            if (value.length && value.every(v => v && typeof v === 'object' && 'name' in v)) {
                const n = value.map(v => (v as Record<string, unknown>).name);
                if (new Set(n).size !== n.length)
                    invalid();
            }
            value.forEach(uniqueCollections);
        }
        else if (value && typeof value === 'object')
            Object.values(value).forEach(uniqueCollections);
    }
    uniqueCollections(projected);
    const encoded = JSON.stringify({ schema: TASK_DIGEST_SCHEMA, registration: projected });
    if (Buffer.byteLength(encoded) > 256 * 1024)
        invalid();
    return { arn: raw.taskDefinitionArn, digestSchema: TASK_DIGEST_SCHEMA, contentDigest: evidenceDigest({ schema: TASK_DIGEST_SCHEMA, registration: projected }), images: images.sort((a, b) => a.container.localeCompare(b.container)) };
}
