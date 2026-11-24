import "server-only";
import {prisma} from "@/lib/db";
import {
  githubCommit, githubRepositoryName, incidentWorkflowRun, incidentWorkflowRunLimit, incidentWorkflowUrl,
  type IncidentSourceEvidence,
} from "@/lib/tauri/incidentSourceEvidenceContract";
import {ticketLinkId} from "@/lib/tauri/ticketDirectoryContract";

interface ReleaseSource {
  id: string;
  organizationId: string;
  applicationId: string;
  targetEnvironmentId: string | null;
  evidenceRepositoryId: string | null;
  rollbackReferenceReleaseId: string | null;
  commitSha: string | null;
}

type EvidenceReader = Pick<typeof prisma, "release" | "environment" | "application" | "repository" | "workflowRunRecord">;

async function readComparison(source: ReleaseSource, commit: string, db: EvidenceReader) {
  const {id, organizationId, rollbackReferenceReleaseId, applicationId, targetEnvironmentId, evidenceRepositoryId} = source;
  if (!rollbackReferenceReleaseId || rollbackReferenceReleaseId === id ||
      !ticketLinkId.safeParse(rollbackReferenceReleaseId).success || !targetEnvironmentId) return null;

  const [baseline, environment, application] = await Promise.all([
    db.release.findFirst({
      where: {id: rollbackReferenceReleaseId, organizationId, applicationId, targetEnvironmentId, evidenceRepositoryId},
      select: {id:true,organizationId:true,applicationId:true,targetEnvironmentId:true,evidenceRepositoryId:true,commitSha:true,releaseTag:true},
    }),
    db.environment.findFirst({where:{id:targetEnvironmentId, organizationId},select:{id:true,organizationId:true}}),
    db.application.findFirst({where:{id:applicationId, organizationId},select:{id:true,organizationId:true}}),
  ]);
  if (environment?.id !== targetEnvironmentId || environment.organizationId !== organizationId ||
      application?.id !== applicationId || application.organizationId !== organizationId ||
      !baseline || baseline.id !== rollbackReferenceReleaseId || baseline.organizationId !== organizationId ||
      baseline.applicationId !== applicationId || baseline.targetEnvironmentId !== targetEnvironmentId ||
      baseline.evidenceRepositoryId !== evidenceRepositoryId) return null;
  const checkedCommit = githubCommit.safeParse(baseline.commitSha);
  if (!checkedCommit.success || checkedCommit.data.toLowerCase() === commit.toLowerCase()) return null;
  return {baselineCommit: checkedCommit.data, baselineTag: baseline.releaseTag?.slice(0,120) ?? null};
}

export async function readIncidentSourceEvidence(source: ReleaseSource, db: EvidenceReader = prisma): Promise<IncidentSourceEvidence> {
  const {organizationId, evidenceRepositoryId: repositoryId} = source;
  const unavailable = {state:"unavailable"} as const;
  const commit = githubCommit.safeParse(source.commitSha);
  if (!repositoryId || !commit.success) return unavailable;
  const readRepository = () => db.repository.findFirst({
    where: {id: repositoryId, organizationId, provider: "github"},
    select: {id:true,organizationId:true,provider:true,remoteOwner:true,remoteName:true,remoteUrl:true},
  });
  const repository = await readRepository();
  if (!repository || repository.id !== repositoryId || repository.organizationId !== organizationId ||
      repository.provider !== "github") return unavailable;
  const name = githubRepositoryName.safeParse(`${repository.remoteOwner}/${repository.remoteName}`);
  if (!name.success) return unavailable;
  const canonical = `https://github.com/${name.data}`;
  if (repository.remoteUrl !== canonical && repository.remoteUrl !== `${canonical}.git`) return unavailable;

  const [rows, comparison] = await Promise.all([
    db.workflowRunRecord.findMany({
      where: {organizationId, repositoryId, commitSha: commit.data},
      orderBy: [{lastSyncedAt:"desc"},{id:"desc"}], take: incidentWorkflowRunLimit + 1,
      select: {organizationId:true, repositoryId:true, commitSha:true, externalRunId:true, workflowName:true, status:true,
        conclusion:true, webUrl:true,lastSyncedAt:true},
    }).catch(() => null),
    readComparison(source, commit.data, db).catch(() => null),
  ]);
  const current = await readRepository();
  if (!current || current.id !== repositoryId || current.organizationId !== organizationId ||
      current.provider !== "github" || current.remoteOwner !== repository.remoteOwner || current.remoteName !== repository.remoteName ||
      current.remoteUrl !== repository.remoteUrl) return unavailable;

  const runs = [];
  let incomplete = false;
  for (const row of (rows ?? []).slice(0,incidentWorkflowRunLimit)) {
    const run = incidentWorkflowRun.safeParse({
      runId: row.externalRunId, name: row.workflowName.trim().slice(0,160), status: row.status,
      conclusion: row.status === "completed" ? row.conclusion : null, observedAt: row.lastSyncedAt.toISOString(),
    });
    if (!run.success || row.organizationId !== organizationId || row.repositoryId !== repositoryId ||
      row.commitSha !== commit.data || row.webUrl !== incidentWorkflowUrl(name.data,run.data.runId)) {
      incomplete = true;
      continue;
    }
    runs.push(run.data);
  }
  return {
    state:"recorded", repository:name.data, commit:commit.data, runs:rows ? runs : null,
    limited:incomplete || (rows?.length ?? 0) > incidentWorkflowRunLimit, comparison,
  };
}
