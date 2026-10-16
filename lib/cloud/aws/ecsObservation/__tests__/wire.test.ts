import { createServer, type Server } from 'node:http';
import { afterEach, expect, it, vi } from 'vitest';
const wire = vi.hoisted(() => ({ port: 0, maxBytes: 512 * 1024, timeoutMs: 1000, budgetCap: 2 * 1024 * 1024, change: "", destinations: [] as string[], keyChecks: [] as boolean[] }));
vi.mock('../boundedAwsHandler', async (original) => {
    const handlerModule = await original<typeof import('../boundedAwsHandler')>();
    const { NodeHttpHandler } = await import('@smithy/node-http-handler');
    const { HttpRequest } = await import('@smithy/core/protocols');
    return { ...handlerModule, boundedAwsHandler: (signal: AbortSignal, budget: {
            remaining: number;
        }) => {
            budget.remaining = Math.min(budget.remaining, wire.budgetCap);
            class OwnedTransport extends NodeHttpHandler {
                handle(request: import('@smithy/core/protocols').HttpRequest, options: Parameters<import('@smithy/node-http-handler').NodeHttpHandler['handle']>[1]) {
                    wire.destinations.push(request.hostname);
                    if (!/^([a-z0-9-]+\.)?(sts|ecs|api\.ecr)\.[a-z0-9-]+\.amazonaws\.com$/.test(request.hostname))
                        throw new Error('unexpected_sdk_destination');
                    return super.handle(new HttpRequest({ ...request, protocol: 'http:', hostname: '127.0.0.1', port: wire.port }), options);
                }
            }
            return handlerModule.boundedAwsHandler(signal, budget, { native: new OwnedTransport(), maxBytes: wire.maxBytes, timeoutMs: wire.timeoutMs });
        } };
});
vi.mock('@/lib/config/env', () => ({ loadAppEnv: () => ({ awsScanMode: 'live', awsBrokerConfigured: true, awsBrokerAccessKeyId: 'synthetic-broker-key', awsBrokerSecretAccessKey: 'synthetic-broker-secret' }) }));
import { readVerifiedEcsObservation } from '../../enrollment/stsValidation';
const account = '123456789012', role = `arn:aws:iam::${account}:role/ReadOnly`, base = `arn:aws:ecs:us-east-1:${account}:`, baseline = base + 'task-definition/app:12', proposed = base + 'task-definition/app:23';
const input = { expectedAccountId: account, roleArn: role, region: 'us-east-1', externalId: 'axiom-' + 'a'.repeat(32), sessionName: 'fixture' };
const target = { roleArn: role, region: 'us-east-1', clusterArn: base + 'cluster/app', serviceArn: base + 'service/app/web', baselineArn: baseline, proposedArn: proposed };
let server: Server | undefined;
afterEach(async () => {
    vi.unstubAllEnvs();
    wire.destinations = [];
    wire.keyChecks = [];
    wire.change = "";
    wire.budgetCap = 2 * 1024 * 1024;
    wire.maxBytes = 512 * 1024;
    wire.timeoutMs = 1000;
    if (server) {
        server.closeAllConnections();
        await new Promise<void>(resolve => server!.close(() => resolve()));
        server = undefined;
    }
});
async function fixture(failure?: 'sts_error' | 'ecs_error' | 'ecr_error' | 'overflow' | 'slow' | 'redirect' | 'compression' | 'early_close' | 'declared_overflow' | 'error_overflow') {
    const calls: string[] = [];
    server = createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req)
            body += chunk;
        const action = new URLSearchParams(body).get('Action') ?? String(req.headers['x-amz-target']).split('.').at(-1)!;
        calls.push(action);
        const expectedKey = action === 'AssumeRole' ? 'synthetic-broker-key' : 'synthetic-temp';
        wire.keyChecks.push(Boolean(req.headers.authorization?.includes('Credential=' + expectedKey + '/')));
        if (req.method !== 'POST' || !req.headers.authorization?.includes('Credential=' + expectedKey + '/')) {
            res.writeHead(400).end();
            return;
        }
        if (failure === 'early_close') {
            res.writeHead(200);
            res.write(' ');
            res.destroy();
            return;
        }
        if (failure === 'declared_overflow') {
            res.writeHead(200, { 'content-length': 1000000 });
            res.end('x');
            return;
        }
        if (failure === 'error_overflow') {
            res.writeHead(403);
            res.end('a'.repeat(2048));
            return;
        }
        if (failure === 'slow') {
            res.writeHead(200);
            res.write(' ');
            return;
        }
        if (failure === 'redirect') {
            res.writeHead(302, { location: 'https://example.invalid' }).end();
            return;
        }
        if (failure === 'compression') {
            res.writeHead(200, { 'content-encoding': 'gzip' }).end('not-gzip');
            return;
        }
        if (failure === 'overflow') {
            res.writeHead(200);
            res.write('a'.repeat(40));
            res.end('b'.repeat(40));
            return;
        }
        if (failure === `${['AssumeRole', 'GetCallerIdentity'].includes(action) ? 'sts' : ['DescribeServices', 'DescribeTaskDefinition'].includes(action) ? 'ecs' : 'ecr'}_error`) {
            res.writeHead(403, { 'content-type': action === 'AssumeRole' ? 'text/xml' : 'application/x-amz-json-1.1' }).end(action === 'AssumeRole' ? '<ErrorResponse><Error><Code>AccessDenied</Code><Message>synthetic-only</Message></Error></ErrorResponse>' : JSON.stringify({ __type: 'AccessDeniedException', message: 'synthetic-only' }));
            return;
        }
        if (action === 'AssumeRole')
            res.end(`<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>synthetic-temp</AccessKeyId><SecretAccessKey>synthetic-secret</SecretAccessKey><SessionToken>synthetic-token</SessionToken><Expiration>2099-01-01T00:00:00Z</Expiration></Credentials><AssumedRoleUser><Arn>arn:aws:sts::${account}:assumed-role/ReadOnly/fixture</Arn></AssumedRoleUser></AssumeRoleResult></AssumeRoleResponse>`);
        else if (action === 'GetCallerIdentity')
            res.end(`<GetCallerIdentityResponse><GetCallerIdentityResult><Account>${account}</Account><Arn>arn:aws:sts::${account}:assumed-role/ReadOnly/fixture</Arn></GetCallerIdentityResult></GetCallerIdentityResponse>`);
        else {
            const data = JSON.parse(body);
            let value: unknown;
            if (action === 'DescribeServices')
                value = { services: [{ serviceArn: target.serviceArn, clusterArn: target.clusterArn, status: 'ACTIVE', taskDefinition: baseline, deployments: [{ id: 'd-one', status: 'PRIMARY', taskDefinition: baseline, rolloutState: 'COMPLETED' }], loadBalancers: [] }] };
            else if (action === 'DescribeTaskDefinition')
                value = { taskDefinition: { taskDefinitionArn: data.taskDefinition, status: 'ACTIVE', family: 'app', revision: Number(data.taskDefinition.split(':').at(-1)), containerDefinitions: [{ name: 'web', image: `${account}.dkr.ecr.us-east-1.amazonaws.com/app@sha256:${(data.taskDefinition === baseline ? 'a' : 'b').repeat(64)}` }] } };
            else if (action === 'DescribeImages')
                value = { imageDetails: data.imageIds.map((x: {
                        imageDigest: string;
                    }) => ({ ...x, registryId: account, repositoryName: 'app', imageStatus: 'ACTIVE', imageManifestMediaType: 'application/vnd.oci.image.manifest.v1+json' })) };
            else {
                res.writeHead(400).end();
                return;
            }
            const json = value as {
                services?: {
                    taskDefinition: string;
                    deployments: unknown[];
                }[];
                taskDefinition?: {
                    taskDefinitionArn: string;
                    containerDefinitions: {
                        name: string;
                        image: string;
                    }[];
                };
                imageDetails?: {
                    imageDigest: string;
                    registryId: string;
                    repositoryName: string;
                    imageStatus?: string;
                }[];
            };
            if (wire.change === 'mixed' && json.services)
                json.services[0].deployments.push({ status: 'ACTIVE' });
            if (wire.change === 'task_arn' && json.taskDefinition)
                json.taskDefinition.taskDefinitionArn = baseline + '0';
            if (wire.change === 'mutable' && json.taskDefinition)
                json.taskDefinition.containerDefinitions[0].image = 'app:latest';
            if (wire.change === 'foreign_image' && json.taskDefinition)
                json.taskDefinition.containerDefinitions[0].image = json.taskDefinition.containerDefinitions[0].image.replace(account, '999999999999');
            if (wire.change === 'duplicate_container' && json.taskDefinition)
                json.taskDefinition.containerDefinitions.push(json.taskDefinition.containerDefinitions[0]);
            if (wire.change === 'ecr_digest' && json.imageDetails)
                json.imageDetails[0].imageDigest = 'sha256:' + 'c'.repeat(64);
            if (wire.change === 'ecr_archived' && json.imageDetails)
                json.imageDetails[0].imageStatus = 'ARCHIVED';
            if (wire.change === 'ecr_status_missing' && json.imageDetails)
                delete json.imageDetails[0].imageStatus;
            if (wire.change === 'ecr_account' && json.imageDetails)
                json.imageDetails[0].registryId = '999999999999';
            if (wire.change === 'ecr_duplicate' && json.imageDetails)
                json.imageDetails[1] = json.imageDetails[0];
            if (wire.change === 'ecr_missing' && json.imageDetails)
                json.imageDetails.pop();
            if (wire.change === 'late_service' && json.services && calls.filter(x => x === 'DescribeServices').length > 1)
                json.services[0].taskDefinition = proposed;
            res.setHeader('content-type', 'application/x-amz-json-1.1');
            res.end(JSON.stringify(value));
        }
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    wire.port = (server.address() as {
        port: number;
    }).port;
    return calls;
}
it('composes actual STS/XML and ECS/ECR/JSON SDK deserialization with native owned wire and no credential output', async () => {
    vi.stubEnv('AWS_ENDPOINT_URL', 'https://forbidden.invalid');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'ambient-must-not-be-used');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'ambient-must-not-be-used');
    const calls = await fixture();
    const result = await readVerifiedEcsObservation(input, target, AbortSignal.timeout(5000));
    expect(calls).toEqual(['AssumeRole', 'GetCallerIdentity', 'DescribeServices', 'DescribeTaskDefinition', 'DescribeTaskDefinition', 'DescribeImages', 'DescribeServices']);
    expect(result.baseline.arn).toBe(baseline);
    expect(result.proposed.arn).toBe(proposed);
    expect(JSON.stringify(result)).not.toContain('synthetic-');
});
it.each(['sts_error', 'ecs_error', 'ecr_error', 'overflow', 'slow', 'redirect', 'compression', 'early_close', 'declared_overflow', 'error_overflow'] as const)('fails closed on actual SDK wire %s without retrying', async (mode) => {
    wire.maxBytes = ['overflow', 'error_overflow'].includes(mode) ? 64 : 512 * 1024;
    wire.timeoutMs = mode === 'slow' ? 30 : 1000;
    const calls = await fixture(mode);
    await expect(readVerifiedEcsObservation(input, target, AbortSignal.timeout(5000))).rejects.toBeDefined();
    expect(calls.filter(x => x === 'AssumeRole')).toHaveLength(1);
    if (mode === 'ecr_error')
        expect(calls.filter(x => x === 'DescribeImages')).toHaveLength(1);
    if (mode === 'ecs_error')
        expect(calls.filter(x => x === 'DescribeServices')).toHaveLength(1);
});
it('exhausts the shared body budget across separate successful SDK calls before later reads', async () => {
    wire.budgetCap = 1000;
    const calls = await fixture();
    await expect(readVerifiedEcsObservation(input, target, AbortSignal.timeout(5000))).rejects.toBeDefined();
    expect(calls).not.toContain('DescribeImages');
    expect(calls.length).toBeLessThan(7);
});
it.each(['mixed', 'task_arn', 'mutable', 'foreign_image', 'duplicate_container', 'ecr_digest', 'ecr_account', 'ecr_archived', 'ecr_status_missing', 'ecr_duplicate', 'ecr_missing', 'late_service'])('rejects real deserialized binding mismatch %s', async (change) => {
    wire.change = change;
    await fixture();
    await expect(readVerifiedEcsObservation(input, target, AbortSignal.timeout(5000))).rejects.toBeDefined();
});
