import { expect, it } from "vitest";
import { projectTaskDefinition } from "../taskDefinition";
const arn = "arn:aws:ecs:us-east-1:123456789012:task-definition/app:1";
const image = `123456789012.dkr.ecr.us-east-1.amazonaws.com/app@sha256:${"a".repeat(64)}`;
const task = () => ({ taskDefinitionArn: arn, revision: 1, status: "ACTIVE", family: "app", containerDefinitions: [{ name: "web", image }], volumes: [] });
it("binds complete modeled registration fields while withholding raw configuration", () => {
    const a = projectTaskDefinition(task());
    const b = projectTaskDefinition({ ...task(), volumes: [{ name: "s3", s3filesVolumeConfiguration: { fileSystemArn: "arn:aws:s3files:us-east-1:123456789012:file-system/fixture", rootDirectory: "/x" } }] });
    expect(a.contentDigest).not.toBe(b.contentDigest);
    expect(a).toEqual({ arn, digestSchema: "axiom.ecs.taskdef.registration.v1", contentDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/), images: [{ container: "web", image }] });
});
it("rejects unknown nested fields, duplicate containers and mutable images", () => {
    expect(() => projectTaskDefinition({ ...task(), containerDefinitions: [{ name: "web", image, unreviewed: true }] })).toThrow();
    expect(() => projectTaskDefinition({ ...task(), containerDefinitions: [{ name: "web", image }, { name: "web", image }] })).toThrow();
    expect(() => projectTaskDefinition({ ...task(), containerDefinitions: [{ name: "web", image: "app:latest" }] })).toThrow();
});
it("preserves command ordering and does not reveal inline environment values", () => {
    const a = projectTaskDefinition({ ...task(), containerDefinitions: [{ name: "web", image, command: ["a", "b"], environment: [{ name: "TOKEN", value: "do-not-return" }] }] });
    const b = projectTaskDefinition({ ...task(), containerDefinitions: [{ name: "web", image, command: ["b", "a"], environment: [{ name: "TOKEN", value: "do-not-return" }] }] });
    expect(a.contentDigest).not.toBe(b.contentDigest);
    expect(JSON.stringify(a)).not.toContain("do-not-return");
});
it('rejects inherited-looking unknown field names and binds own prototype-named labels', () => {
    for (const key of ['__proto__', 'constructor', 'toString'])
        expect(() => projectTaskDefinition({ ...task(), containerDefinitions: [JSON.parse(`{"name":"web","image":"${image}","${key}":true}`)] })).toThrow();
    const a = projectTaskDefinition({ ...task(), containerDefinitions: [{ name: 'web', image, dockerLabels: JSON.parse('{"__proto__":"a"}') }] });
    const b = projectTaskDefinition({ ...task(), containerDefinitions: [{ name: 'web', image, dockerLabels: JSON.parse('{"__proto__":"b"}') }] });
    expect(a.contentDigest).not.toBe(b.contentDigest);
});
it('pins every recursively reachable registration field to the installed SDK declaration snapshot', async () => {
    const { execFileSync } = await import('node:child_process');
    expect(execFileSync(process.execPath, ['scripts/fixtures/generateEcsTaskSchema.cjs', '--check'], { encoding: 'utf8' }).trim()).toBe('57');
});
it.each([Infinity, 9007199254740992, 1.5, 0, -1])('rejects unsafe revision identity %s', revision => { expect(() => projectTaskDefinition({ ...task(), revision, taskDefinitionArn: arn.replace(':1', ':' + revision) })).toThrow(); });
it('binds every optional top-level registration field and the complete nested model projection', async () => {
    const snapshot = (await import('../taskDefinitionSchema.json')).default;
    type Node = string | {
        ref: string;
    } | {
        array: Node;
    } | {
        map: Node;
    } | {
        enum: string[];
    } | {
        fields: Record<string, {
            schema: Node;
            optional: boolean;
        }>;
    };
    const defs = snapshot.definitions as unknown as Record<string, Node>;
    function sample(node: Node): unknown {
        if (typeof node === 'string')
            return node === 'string' ? 'fixture' : node === 'number' ? 1 : false;
        if ('ref' in node)
            return sample(defs[node.ref]);
        if ('array' in node)
            return [sample(node.array)];
        if ('map' in node)
            return { key: sample(node.map) };
        if ('enum' in node)
            return node.enum[0];
        return Object.fromEntries(Object.entries(node.fields).map(([k, v]) => [k, sample(v.schema)]));
    }
    const full = sample(defs.RegisterTaskDefinitionRequest) as Record<string, unknown>;
    full.family = 'app';
    const containers = full.containerDefinitions as Record<string, unknown>[];
    containers[0].name = 'web';
    containers[0].image = image;
    const complete = { ...full, taskDefinitionArn: arn, status: 'ACTIVE', revision: 1 };
    const original = projectTaskDefinition(complete);
    for (const key of Object.keys(full).filter(k => !['family', 'containerDefinitions'].includes(k))) {
        const changed = { ...complete };
        delete changed[key as keyof typeof changed];
        expect(projectTaskDefinition(changed).contentDigest, key).not.toBe(original.contentDigest);
    }
});
