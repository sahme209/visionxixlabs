import { expect, it, vi } from 'vitest';
import { projectTargetSnapshot } from '@/lib/releaseops/ecsReleaseV2/targetSnapshot';
import { createAwsEnrollmentService } from '../../enrollment/service';
import { fixture, input, externalId, principal } from '../../enrollment/__tests__/fixture';
import { readTenantEcsObservation, type EcsObservationRepo } from '../reader';
const base = `arn:aws:ecs:${input.region}:${input.expectedAccountId}:`;
async function ready() {
    const f = fixture(), service = createAwsEnrollmentService(f.typedRepo, f.dependencies), start = await service.start(principal, input), result = await service.complete(principal, start.attemptId, externalId);
    const environment = { id: 'env', organizationId: principal.organizationId, updatedAt: f.dependencies.now() };
    const target = { id: 'target', organizationId: principal.organizationId, environmentId: 'env', provider: 'aws', roleArn: input.roleArn, region: input.region, ecsCluster: 'app', ecsService: 'web', updatedAt: f.dependencies.now() };
    const repo: EcsObservationRepo = Object.assign(f.typedRepo, { environment: { findFirst: vi.fn(async () => environment) }, deploymentTarget: { findUnique: vi.fn(async () => target) } });
    const read = vi.fn(async () => ({ baseline: { arn: base + 'task-definition/app:1', digestSchema: 'axiom.ecs.taskdef.registration.v1' as const, contentDigest: 'sha256:' + 'a'.repeat(64), images: [] }, proposed: { arn: base + 'task-definition/app:2', digestSchema: 'axiom.ecs.taskdef.registration.v1' as const, contentDigest: 'sha256:' + 'b'.repeat(64), images: [] }, associatedTargetGroupArns: [] }));
    const request = { environmentId: 'env', cloudAccountId: result.account.id, baselineArn: base + 'task-definition/app:1', proposedArn: base + 'task-definition/app:2' };
    const dependencies = { now: f.dependencies.now, open: vi.fn(() => JSON.stringify({ ...input, externalId })), read };
    return { f, repo, target, environment, read, request, dependencies };
}
it('composes scoped enrollment vault, current target and observation-only DTO without enabling execution', async () => {
    const x = await ready(), r = await readTenantEcsObservation(x.repo, principal, x.request, x.dependencies);
    expect(r).toMatchObject({ kind: 'aws_ecs_observation', connection: { id: x.request.cloudAccountId, version: 1 }, targetSnapshot: { id: 'target' }, limits: { executionAuthorized: false, healthVerified: false, rollbackVerified: false } });
    expect(JSON.stringify(r)).not.toContain(externalId);
    expect(r).not.toHaveProperty('revision');
    expect(x.f.state.account?.enabled).toBe(false);
    expect(x.dependencies.open).toHaveBeenCalledWith('v2.fixture-sealed', `cloud-account-credential-v1:${principal.organizationId}:aws:${x.request.cloudAccountId}:1`);
});
it.each(['read_role', 'foreign_tenant', 'wrong_role', 'wrong_region', 'disconnected', 'legacy_ref'] as const)('denies %s before provider reads', async (mode) => {
    const x = await ready();
    if (mode === 'read_role')
        x.f.state.membership.role = 'read_only';
    if (mode === 'foreign_tenant')
        x.target.organizationId = 'foreign';
    if (mode === 'wrong_role')
        x.target.roleArn += 'Changed';
    if (mode === 'wrong_region')
        x.target.region = 'us-west-2';
    if (mode === 'disconnected')
        x.f.state.credential!.revokedAt = x.f.dependencies.now();
    if (mode === 'legacy_ref')
        x.f.state.account!.credentialRef = 'lead-old';
    await expect(readTenantEcsObservation(x.repo, principal, x.request, x.dependencies)).rejects.toThrow('ecs_observation_unavailable');
    expect(x.read).not.toHaveBeenCalled();
});
it.each(['session', 'membership', 'credential', 'connection', 'target', 'environment'] as const)('withholds late observations after %s changes', async (mode) => {
    const x = await ready();
    const value = await x.read();
    x.read.mockImplementation(async () => {
        if (mode === 'session')
            x.f.state.device.revokedAt = x.f.dependencies.now();
        if (mode === 'membership')
            x.f.state.membership.role = 'read_only';
        if (mode === 'credential')
            x.f.state.credential!.version++;
        if (mode === 'connection')
            x.f.state.account!.credentialRef = null;
        if (mode === 'target')
            x.target.updatedAt = new Date(x.target.updatedAt.getTime() + 1);
        if (mode === 'environment')
            x.environment.updatedAt = new Date(x.environment.updatedAt.getTime() + 1);
        return value;
    });
    await expect(readTenantEcsObservation(x.repo, principal, x.request, x.dependencies)).rejects.toThrow('ecs_observation_unavailable');
});

it('produces the canonical persisted target, environment and connection snapshot', async () => {
    const x = await ready();
    const result = await readTenantEcsObservation(x.repo, principal, x.request, x.dependencies);
    expect(result.targetSnapshot).toEqual(projectTargetSnapshot({ target: x.target, environment: x.environment, account: x.f.state.account!, credential: x.f.state.credential! }));
    expect(result.targetSnapshot).toMatchObject({ schema: 'axiom.ecs.target-snapshot.v1', connection: { id: x.request.cloudAccountId, version: 1 } });
});
it('rejects recreation of the target row during provider IO even with identical coordinates and timestamp', async () => {
    const x = await ready(), value = await x.read();
    x.read.mockImplementation(async () => { x.target.id = 'replacement-target'; return value; });
    await expect(readTenantEcsObservation(x.repo, principal, x.request, x.dependencies)).rejects.toThrow('ecs_observation_unavailable');
});
