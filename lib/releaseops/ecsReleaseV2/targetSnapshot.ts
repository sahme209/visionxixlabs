import { evidenceDigest, type TargetSnapshot } from './contract';
export interface TargetSnapshotRows {
    target: { id: string; organizationId: string; environmentId: string; provider: string; roleArn: string; region: string; ecsCluster: string; ecsService: string; updatedAt: Date };
    environment: { id: string; organizationId: string; updatedAt: Date };
    account: { id: string; organizationId: string; provider: string; externalAccountId: string; credentialRef: string | null; regions: string[]; enabled: boolean; updatedAt: Date };
    credential: { id: string; organizationId: string; version: number; revokedAt: Date | null };
}
const identity = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x20\x7f]/.test(value);
const date = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
/** Equality identity from independently loaded rows only. No secret material,
 * monotonic generation, provenance, management readiness or execution permit. */
export function projectTargetSnapshot(rows: TargetSnapshotRows): TargetSnapshot | null {
    try {
        const { target: t, environment: e, account: a, credential: c } = rows;
        if (![t.id, t.organizationId, t.environmentId, e.id, e.organizationId, a.id, a.organizationId, c.id, c.organizationId].every(identity)
            || t.organizationId !== e.organizationId || t.organizationId !== a.organizationId || t.organizationId !== c.organizationId
            || t.environmentId !== e.id || a.id !== c.id || t.provider !== 'aws' || a.provider !== 'aws'
            || a.credentialRef !== `cloud-v2:${a.id}` || c.revokedAt !== null
            || !Number.isSafeInteger(c.version) || c.version < 1 || c.version > 2147483647
            || ![t.updatedAt, e.updatedAt, a.updatedAt].every(date) || typeof a.enabled !== 'boolean'
            || !Array.isArray(a.regions) || a.regions.length > 100 || !a.regions.every(identity) || !a.regions.includes(t.region)
            || typeof a.externalAccountId !== 'string' || !/^\d{12}$/.test(a.externalAccountId)
            || typeof t.region !== 'string' || !/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(t.region)
            || typeof t.ecsCluster !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(t.ecsCluster)
            || typeof t.ecsService !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(t.ecsService)) return null;
        const role = /^arn:(aws|aws-us-gov|aws-cn):iam::(\d{12}):role\/[A-Za-z0-9_+=,.@/-]{1,512}$/.exec(t.roleArn);
        if (!role || role[2] !== a.externalAccountId || (role[1] === 'aws-cn') !== t.region.startsWith('cn-') || (role[1] === 'aws-us-gov') !== t.region.startsWith('us-gov-')) return null;
        const schema = 'axiom.ecs.target-snapshot.v1' as const;
        const material = {
            schema,
            target: { id: t.id, organizationId: t.organizationId, environmentId: t.environmentId, provider: t.provider, roleArn: t.roleArn, region: t.region, ecsCluster: t.ecsCluster, ecsService: t.ecsService, updatedAt: t.updatedAt.toISOString() },
            environment: { id: e.id, organizationId: e.organizationId, updatedAt: e.updatedAt.toISOString() },
            connection: { id: a.id, organizationId: a.organizationId, provider: a.provider, externalAccountId: a.externalAccountId, credentialRef: a.credentialRef, regions: [...a.regions], enabled: a.enabled, updatedAt: a.updatedAt.toISOString(), version: c.version },
        };
        return { schema, id: t.id, digest: evidenceDigest(material), connection: { id: a.id, version: c.version } };
    } catch { return null; }
}
