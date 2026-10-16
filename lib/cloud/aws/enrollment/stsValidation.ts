import "server-only";
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { loadAppEnv } from "@/lib/config/env";
import { boundedAwsHandler, awsReadEndpoint, type AwsResponseBudget } from "../ecsObservation/boundedAwsHandler";
import { AwsEnrollmentError, type AwsEnrollmentInput } from "./policy";
export function assertAwsEnrollmentConfigured(): void {
    const config = loadAppEnv();
    if (process.env.ENABLE_CLOUD_CONNECTORS_AWS === "false" || config.awsScanMode !== "live" || !config.awsBrokerConfigured)
        throw new AwsEnrollmentError("enrollment_unavailable");
}
async function assumeVerifiedRole(input: AwsEnrollmentInput & {
    externalId: string;
    sessionName: string;
}, profile?: {
    signal: AbortSignal;
    budget: AwsResponseBudget;
}): Promise<{
    accountId: string;
    assumedRoleArn: string;
    credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string;
    };
}> {
    assertAwsEnrollmentConfigured();
    const config = loadAppEnv();
    const broker = new STSClient({ region: input.region, credentials: { accessKeyId: config.awsBrokerAccessKeyId!, secretAccessKey: config.awsBrokerSecretAccessKey! }, maxAttempts: profile ? 1 : 2, ...(profile ? { ignoreConfiguredEndpointUrls: true, endpoint: awsReadEndpoint("sts", input.region, input.roleArn.split(":")[1]), useFipsEndpoint: false, useDualstackEndpoint: false, requestHandler: boundedAwsHandler(profile.signal, profile.budget) } : {}) });
    const timeout = profile ? AbortSignal.any([profile.signal, AbortSignal.timeout(6000)]) : AbortSignal.timeout(8000);
    try {
        const assumed = await broker.send(new AssumeRoleCommand({ RoleArn: input.roleArn, ExternalId: input.externalId, RoleSessionName: input.sessionName, DurationSeconds: 900 }), { abortSignal: timeout });
        const credentials = assumed.Credentials;
        const assumedRoleArn = assumed.AssumedRoleUser?.Arn;
        const partition = input.roleArn.split(":")[1];
        if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken || !assumedRoleArn || assumedRoleArn !== `arn:${partition}:sts::${input.expectedAccountId}:assumed-role/${input.roleArn.split("/").at(-1)}/${input.sessionName}`)
            throw new AwsEnrollmentError("aws_identity_unverified");
        const tenant = new STSClient({ region: input.region, credentials: { accessKeyId: credentials.AccessKeyId, secretAccessKey: credentials.SecretAccessKey, sessionToken: credentials.SessionToken }, maxAttempts: profile ? 1 : 2, ...(profile ? { ignoreConfiguredEndpointUrls: true, endpoint: awsReadEndpoint("sts", input.region, input.roleArn.split(":")[1]), useFipsEndpoint: false, useDualstackEndpoint: false, requestHandler: boundedAwsHandler(profile.signal, profile.budget) } : {}) });
        try {
            const identity = await tenant.send(new GetCallerIdentityCommand({}), { abortSignal: timeout });
            if (identity.Account !== input.expectedAccountId || identity.Arn !== assumedRoleArn)
                throw new AwsEnrollmentError("aws_identity_unverified");
            return { accountId: identity.Account, assumedRoleArn, credentials: { accessKeyId: credentials.AccessKeyId, secretAccessKey: credentials.SecretAccessKey, sessionToken: credentials.SessionToken } };
        }
        finally {
            tenant.destroy();
        }
    }
    catch {
        throw new AwsEnrollmentError("aws_identity_unverified");
    }
    finally {
        broker.destroy();
    }
}
export async function validateEnrollmentRole(input: AwsEnrollmentInput & {
    externalId: string;
    sessionName: string;
}): Promise<{
    accountId: string;
    assumedRoleArn: string;
}> {
    const { accountId, assumedRoleArn } = await assumeVerifiedRole(input);
    return { accountId, assumedRoleArn };
}
export async function readEnrollmentInventory(input: AwsEnrollmentInput & {
    externalId: string;
    sessionName: string;
}) {
    const verified = await assumeVerifiedRole(input);
    const { EC2Client, DescribeInstancesCommand } = await import("@aws-sdk/client-ec2");
    const client = new EC2Client({ region: input.region, credentials: verified.credentials, maxAttempts: 2 });
    try {
        const response = await client.send(new DescribeInstancesCommand({ MaxResults: 5 }), { abortSignal: AbortSignal.timeout(6000) });
        const instances = (response.Reservations ?? []).flatMap((reservation) => reservation.Instances ?? []);
        return { accountId: verified.accountId, region: input.region, source: "live" as const, complete: false as const, truncated: Boolean(response.NextToken) || instances.length > 5,
            instances: instances.slice(0, 5).map((instance) => ({ instanceId: instance.InstanceId ?? "unknown", state: instance.State?.Name ?? "unknown", instanceType: instance.InstanceType ?? "unknown", availabilityZone: instance.Placement?.AvailabilityZone ?? "unknown" })), observedAt: new Date().toISOString() };
    }
    catch (error) {
        const name = error instanceof Error ? error.name : "";
        if (["UnauthorizedOperation", "AccessDenied", "AccessDeniedException"].includes(name))
            throw new AwsEnrollmentError("aws_inventory_denied");
        throw new AwsEnrollmentError("enrollment_unavailable");
    }
    finally {
        client.destroy();
    }
}
/** Internal inactive observation entrypoint; credentials remain inside this broker-owned call stack. */
export async function readVerifiedEcsObservation(input: AwsEnrollmentInput & {
    externalId: string;
    sessionName: string;
}, target: import("../ecsObservation/sdkObservation").EcsObservationTarget, signal: AbortSignal) {
    const budget = { remaining: 2 * 1024 * 1024 };
    const verified = await assumeVerifiedRole(input, { signal, budget });
    const { describeEcsResources } = await import("../ecsObservation/sdkObservation");
    return describeEcsResources(verified.credentials, verified.accountId, target, signal, budget);
}
