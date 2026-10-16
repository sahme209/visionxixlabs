import { expect, it } from 'vitest';
import { evidenceDigest } from '../contract';
import { projectTargetSnapshot } from '../targetSnapshot';
import { reviewSnapshotRows } from '@/scripts/fixtures/ecsReviewFixture';

it('projects only explicitly selected nonsecret persisted identity with ISO dates', () => {
    const rows = reviewSnapshotRows();
    Object.assign(rows.credential, { encryptedConfiguration: 'ciphertext-never-hashed', externalId: 'secret-never-hashed' });
    const snapshot = projectTargetSnapshot(rows);
    expect(snapshot).toEqual({ schema: 'axiom.ecs.target-snapshot.v1', id: 'target-1', connection: { id: 'connection-1', version: 2 }, digest: evidenceDigest({
        schema: 'axiom.ecs.target-snapshot.v1',
        target: { ...rows.target, updatedAt: rows.target.updatedAt.toISOString() },
        environment: { ...rows.environment, updatedAt: rows.environment.updatedAt.toISOString() },
        connection: { ...rows.account, updatedAt: rows.account.updatedAt.toISOString(), version: rows.credential.version },
    }) });
    expect(projectTargetSnapshot(reviewSnapshotRows())).toEqual(snapshot);
    expect(JSON.stringify(snapshot)).not.toContain('never-hashed');
});

it.each(['target.id', 'target.organizationId', 'target.environmentId', 'target.provider', 'target.roleArn', 'target.region', 'target.ecsCluster', 'target.ecsService', 'target.updatedAt', 'environment.id', 'environment.organizationId', 'environment.updatedAt', 'account.id', 'account.organizationId', 'account.provider', 'account.externalAccountId', 'account.credentialRef', 'account.regions', 'account.enabled', 'account.updatedAt', 'credential.id', 'credential.organizationId', 'credential.version', 'credential.revokedAt'])(
    'invalidates or changes identity for persisted %s drift', path => {
        const rows = reviewSnapshotRows();
        const before = projectTargetSnapshot(rows)!;
        const [section, key] = path.split('.');
        const record = rows[section as keyof typeof rows] as unknown as Record<string, unknown>;
        const value = record[key];
        record[key] = value instanceof Date ? new Date(value.getTime() + 1) : Array.isArray(value) ? [...value, 'us-west-2'] : typeof value === 'number' ? value + 1 : typeof value === 'boolean' ? !value : value === null ? new Date() : `${value}-changed`;
        expect(projectTargetSnapshot(rows)?.digest).not.toBe(before.digest);
    });
it.each([0, -1, 1.5, 2147483648, NaN])('refuses invalid stored credential version %s', version => {
    const rows = reviewSnapshotRows(); rows.credential.version = version;
    expect(projectTargetSnapshot(rows)).toBeNull();
});
it('refuses malformed timestamps and unavailable selected region', () => {
    const rows = reviewSnapshotRows(); rows.environment.updatedAt = new Date(NaN);
    expect(projectTargetSnapshot(rows)).toBeNull();
    const missingRegion = reviewSnapshotRows(); missingRegion.account.regions = [];
    expect(projectTargetSnapshot(missingRegion)).toBeNull();
});
