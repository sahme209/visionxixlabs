/** IO boundary: compares the commit about to deploy with the last successful deployment of the same repository to the same environment. Never throws. */
import { compareCommitFiles } from "@/lib/connectors/github/githubWriteClient";
import { migrationPaths, type DatabaseChangeEvidence } from "./databaseChangeDetection";

export interface LastDeploymentRepo {
  deploymentExecution: { findFirst(args: { where: { organizationId: string; environmentId: string; repositoryFullName: string; status: "completed"; conclusion: "success"; sourceCommitSha: { not: null } }; orderBy: { createdAt: "desc" }; select: { sourceCommitSha: true } }): Promise<{ sourceCommitSha: string | null } | null> };
}

export async function readDatabaseChangeEvidence(repo: LastDeploymentRepo, input: { organizationId: string; environmentId: string; owner: string; repo: string; commitSha: string; installationToken: string; compare?: typeof compareCommitFiles }): Promise<DatabaseChangeEvidence> {
  try {
    const last = await repo.deploymentExecution.findFirst({ where: { organizationId: input.organizationId, environmentId: input.environmentId, repositoryFullName: `${input.owner}/${input.repo}`, status: "completed", conclusion: "success", sourceCommitSha: { not: null } }, orderBy: { createdAt: "desc" }, select: { sourceCommitSha: true } });
    const since = last?.sourceCommitSha;
    if (!since) return { status: "first_deployment" };
    if (since === input.commitSha) return { status: "same_commit", since };
    const diff = await (input.compare ?? compareCommitFiles)({ owner: input.owner, repo: input.repo, base: since, head: input.commitSha, installationToken: input.installationToken });
    if (!diff.ok) return { status: "unknown", reason: "compare_unavailable" };
    const paths = migrationPaths(diff.data.files);
    return paths.length ? { status: "detected", since, paths: paths.slice(0, 50), truncated: diff.data.truncated } : { status: "none_detected", since, truncated: diff.data.truncated };
  } catch {
    return { status: "unknown", reason: "read_failed" };
  }
}
