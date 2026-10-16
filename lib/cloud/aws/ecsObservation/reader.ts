import "server-only";
import { projectTargetSnapshot } from "@/lib/releaseops/ecsReleaseV2/targetSnapshot";
import { randomBytes } from "node:crypto";
import { withTenantAwsConnection } from "../enrollment/scopedConnection";
import type { EnrollmentRepo, EnrollmentPrincipal } from "../enrollment/service";
import { readVerifiedEcsObservation } from "../enrollment/stsValidation";
import type { EcsObservationTarget } from "./sdkObservation";
interface TargetRow {
    id: string;
    organizationId: string;
    environmentId: string;
    provider: string;
    roleArn: string;
    region: string;
    ecsCluster: string;
    ecsService: string;
    updatedAt: Date;
}
export interface EcsObservationRepo extends EnrollmentRepo {
    environment: {
        findFirst(args: Record<string, unknown>): Promise<{
            id: string;
            organizationId: string;
            updatedAt: Date;
        } | null>;
    };
    deploymentTarget: {
        findUnique(args: Record<string, unknown>): Promise<TargetRow | null>;
    };
}
export async function readTenantEcsObservation(repo: EcsObservationRepo, principal: EnrollmentPrincipal, request: {
    environmentId: string;
    cloudAccountId: string;
    baselineArn: string;
    proposedArn: string;
}, dependencies: {
    now?: () => Date;
    open?: NonNullable<Parameters<typeof withTenantAwsConnection>[4]>['open'];
    read?: typeof readVerifiedEcsObservation;
} = {}) {
    request = structuredClone(request);
    principal = structuredClone(principal);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 45000), signal = controller.signal;
    try {
        const operation = withTenantAwsConnection(repo, principal, request.cloudAccountId, async (input, connection, connectionRows) => {
            async function snapshot() {
                signal.throwIfAborted();
                const environment = await repo.environment.findFirst({ where: { id: request.environmentId, organizationId: principal.organizationId } });
                const target = await repo.deploymentTarget.findUnique({ where: { environmentId: request.environmentId } });
                if (!environment || environment.organizationId !== principal.organizationId || !target || target.environmentId !== environment.id || target.organizationId !== principal.organizationId || target.provider !== 'aws' || target.roleArn !== input.roleArn || target.region !== input.region || !Number.isFinite(target.updatedAt.getTime()))
                    throw new Error('ecs_observation_unavailable');
                return structuredClone({ environment, target });
            }
            const before = await snapshot(), t = before.target, partition = input.roleArn.split(':')[1], prefix = `arn:${partition}:ecs:${input.region}:${input.expectedAccountId}:`;
            if (!/^[A-Za-z0-9_-]{1,255}$/.test(t.ecsCluster) || !/^[A-Za-z0-9_-]{1,255}$/.test(t.ecsService))
                throw new Error('ecs_observation_unavailable');
            const target: EcsObservationTarget = { roleArn: t.roleArn, region: t.region, clusterArn: prefix + 'cluster/' + t.ecsCluster, serviceArn: prefix + 'service/' + t.ecsCluster + '/' + t.ecsService, baselineArn: request.baselineArn, proposedArn: request.proposedArn };
            signal.throwIfAborted();
            const observed = await (dependencies.read ?? readVerifiedEcsObservation)({ ...input, sessionName: `axiom-ecs-read-${randomBytes(10).toString('hex')}` }, target, signal);
            if (JSON.stringify(before) !== JSON.stringify(await snapshot()))
                throw new Error('ecs_observation_unavailable');
            signal.throwIfAborted();
            const targetSnapshot = projectTargetSnapshot({ ...before, ...connectionRows });
            if (!targetSnapshot) throw new Error('ecs_observation_unavailable');
            return { kind: 'aws_ecs_observation' as const, organizationId: principal.organizationId, environmentId: request.environmentId, connection, targetSnapshot, accountId: input.expectedAccountId, partition, region: input.region, roleArn: input.roleArn, clusterArn: target.clusterArn, serviceArn: target.serviceArn, ...observed, observedAt: (dependencies.now?.() ?? new Date()).toISOString(), limits: { providerReadOnly: true, serviceSnapshotOnly: true, registryPullabilityVerified: false, healthVerified: false, rollbackVerified: false, executionAuthorized: false } };
        }, { now: dependencies.now, open: dependencies.open, managementOnly: true });
        return await Promise.race([operation, new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('ecs_observation_unavailable')), { once: true }))]);
    }
    catch {
        throw new Error('ecs_observation_unavailable');
    }
    finally {
        clearTimeout(timer);
        controller.abort();
    }
}
