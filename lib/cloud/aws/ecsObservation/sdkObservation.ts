import "server-only";
import { ECSClient, DescribeServicesCommand, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { ECRClient, DescribeImagesCommand } from "@aws-sdk/client-ecr";
import { boundedAwsHandler, awsReadEndpoint, type AwsResponseBudget } from "./boundedAwsHandler";
import { projectTaskDefinition } from "./taskDefinition";
export interface EcsObservationTarget {
    roleArn: string;
    region: string;
    clusterArn: string;
    serviceArn: string;
    baselineArn: string;
    proposedArn: string;
}
/** Internal implementation only: called inside broker verification, never exposed as a credential callback. */
export async function describeEcsResources(credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
}, accountId: string, target: EcsObservationTarget, signal: AbortSignal, budget: AwsResponseBudget) {
    const partition = target.roleArn.split(':')[1], prefix = `arn:${partition}:ecs:${target.region}:${accountId}:`;
    if (!target.clusterArn.startsWith(prefix + 'cluster/') || !target.serviceArn.startsWith(prefix + 'service/' + target.clusterArn.split('/')[1] + '/') || ![target.baselineArn, target.proposedArn].every(a => new RegExp(`^${prefix}task-definition/[A-Za-z0-9_-]+:[1-9][0-9]*$`).test(a)) || target.baselineArn === target.proposedArn)
        throw new Error('ecs_observation_unavailable');
    const ecs = new ECSClient({ region: target.region, credentials, maxAttempts: 1, ignoreConfiguredEndpointUrls: true, endpoint: awsReadEndpoint("ecs", target.region, partition), useFipsEndpoint: false, useDualstackEndpoint: false, requestHandler: boundedAwsHandler(signal, budget) });
    const ecr = new ECRClient({ region: target.region, credentials, maxAttempts: 1, ignoreConfiguredEndpointUrls: true, endpoint: awsReadEndpoint("ecr", target.region, partition), useFipsEndpoint: false, useDualstackEndpoint: false, requestHandler: boundedAwsHandler(signal, budget) });
    try {
        async function service() {
            const r = await ecs.send(new DescribeServicesCommand({ cluster: target.clusterArn, services: [target.serviceArn] }), { abortSignal: signal });
            if (r.failures?.length || r.services?.length !== 1)
                throw new Error('ecs_observation_unavailable');
            const s = r.services[0];
            if (s.serviceArn !== target.serviceArn || s.clusterArn !== target.clusterArn || s.status !== 'ACTIVE' || s.taskDefinition !== target.baselineArn || s.deployments?.length !== 1 || s.deployments[0].status !== 'PRIMARY' || s.deployments[0].taskDefinition !== target.baselineArn || s.deployments[0].rolloutState !== 'COMPLETED')
                throw new Error('ecs_observation_unavailable');
            return { serviceArn: s.serviceArn, clusterArn: s.clusterArn, taskDefinition: s.taskDefinition, deployments: s.deployments, loadBalancers: s.loadBalancers ?? [], desiredCount: s.desiredCount, runningCount: s.runningCount, pendingCount: s.pendingCount };
        }
        const before = await service();
        async function task(arn: string) {
            const r = await ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: arn }), { abortSignal: signal });
            if (r.taskDefinition?.taskDefinitionArn !== arn)
                throw new Error('ecs_observation_unavailable');
            return projectTaskDefinition(r.taskDefinition);
        }
        const baseline = await task(target.baselineArn), proposed = await task(target.proposedArn);
        const images = [...baseline.images, ...proposed.images];
        if (images.length > 10)
            throw new Error('ecs_observation_unavailable');
        const repositories = new Map<string, Set<string>>();
        for (const image of images) {
            const m = /^(\d{12})\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com(\.cn)?\/(.+)@sha256:([a-f0-9]{64})$/.exec(image.image);
            if (!m || m[1] !== accountId || m[2] !== target.region || Boolean(m[3]) !== (partition === 'aws-cn'))
                throw new Error('ecs_observation_unavailable');
            const set = repositories.get(m[4]) ?? new Set();
            set.add(`sha256:${m[5]}`);
            repositories.set(m[4], set);
        }
        if (repositories.size > 4)
            throw new Error('ecs_observation_unavailable');
        for (const [repositoryName, digests] of repositories) {
            const r = await ecr.send(new DescribeImagesCommand({ registryId: accountId, repositoryName, imageIds: [...digests].map(imageDigest => ({ imageDigest })) }), { abortSignal: signal });
            if (r.nextToken || r.imageDetails?.length !== digests.size)
                throw new Error('ecs_observation_unavailable');
            const seen = new Set<string>();
            for (const d of r.imageDetails) {
                if (d.registryId !== accountId || d.repositoryName !== repositoryName || !d.imageDigest || d.imageStatus !== "ACTIVE" || !digests.has(d.imageDigest) || seen.has(d.imageDigest) || !['application/vnd.oci.image.manifest.v1+json', 'application/vnd.oci.image.index.v1+json', 'application/vnd.docker.distribution.manifest.v2+json', 'application/vnd.docker.distribution.manifest.list.v2+json'].includes(d.imageManifestMediaType ?? ''))
                    throw new Error('ecs_observation_unavailable');
                seen.add(d.imageDigest);
            }
        }
        const after = await service();
        if (JSON.stringify(before) !== JSON.stringify(after))
            throw new Error('ecs_observation_unavailable');
        const associatedTargetGroupArns = before.loadBalancers.map(x => x.targetGroupArn);
        if (associatedTargetGroupArns.some(a => !a || !a.startsWith(`arn:${partition}:elasticloadbalancing:${target.region}:${accountId}:targetgroup/`)))
            throw new Error('ecs_observation_unavailable');
        return { baseline, proposed, associatedTargetGroupArns: associatedTargetGroupArns as string[] };
    }
    finally {
        ecs.destroy();
        ecr.destroy();
    }
}
