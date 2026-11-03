import "server-only";
import { resolveReleaseInstallationToken } from "@/lib/connectors/github/githubAppAuth";
import { prisma } from "@/lib/db";
import { assertNoGovernanceEnrollmentForMutation } from "@/lib/governance/intelligence/enrollmentMetadata";
import { resolveTenantScopedToken } from "@/lib/connectors/github/resolveTenantScopedToken";
import type { RepoCoordinates } from "./parseRepoRef";
import { fetchFileContent } from "./githubWriteClient";
/** No environment token or owner impersonation fallback. */
export async function resolveCodingGithubCredential(organizationId: string, repository: RepoCoordinates) {
    const authority = await captureCodingAuthority(organizationId, repository, "contents_read");
    return authority.ok ? authority.resolveToken() : authority;
}
/** Re-resolve workspace authority before each required file read. */
export async function readCodingGithubFile(organizationId: string, repository: RepoCoordinates, path: string, ref: string) {
    const credential = await resolveCodingGithubCredential(organizationId, repository);
    if (!credential.ok)
        return { ok: false as const, reason: "fetch_failed" as const, detail: "Workspace GitHub connection is unavailable." };
    return fetchFileContent(repository.owner, repository.repo, path, ref, credential.token);
}
export type CodingWriteAuthority = {
    ok: true;
    resolveToken: () => Promise<{
        ok: true;
        token: string;
    } | {
        ok: false;
        error: string;
    }>;
} | {
    ok: false;
    error: string;
};
/** Capture server-owned installation identity; every token resolution rechecks its revision. */
export async function createCodingWriteAuthority(organizationId: string, repository: RepoCoordinates, assertStageCurrent?: (purpose?: "issuance") => Promise<() => void>): Promise<CodingWriteAuthority> {
    if (typeof assertStageCurrent !== "function")
        return { ok: false, error: "coding_stage_claim_required" };
    try {
        await assertStageCurrent();
        const row = await prisma.gitHubInstallation.findFirst({ where: { organizationId, status: "active" }, orderBy: { installedAt: "desc" }, select: { id: true, githubInstallationId: true, updatedAt: true, revokedAt: true, suspendedAt: true } });
        if (!row || row.revokedAt || row.suspendedAt || !(row.updatedAt instanceof Date))
            return { ok: false, error: "github_not_connected" };
        const pin = { id: row.id, githubInstallationId: row.githubInstallationId, revision: row.updatedAt.toISOString() }, target = { owner: repository.owner, repo: repository.repo };
        let attempted = false;
        return { ok: true, resolveToken: async () => {
                try {
                    if (attempted)
                        return { ok: false as const, error: "github_write_authority_unavailable" };
                    attempted = true;
                    const current = async () => {
                        const stageFresh = await assertStageCurrent("issuance");
                        await assertNoGovernanceEnrollmentForMutation(prisma, organizationId);
                        const now = await prisma.gitHubInstallation.findFirst({ where: { organizationId, status: "active" }, orderBy: { installedAt: "desc" } });
                        if (!now || now.id !== pin.id || now.githubInstallationId !== pin.githubInstallationId || now.updatedAt.toISOString() !== pin.revision || now.revokedAt || now.suspendedAt)
                            throw Error();
                        stageFresh();
                        return stageFresh;
                    };
                    const signal = AbortSignal.timeout(15000), value = await resolveReleaseInstallationToken({ installationId: pin.githubInstallationId, repositoryFullName: target.owner + '/' + target.repo, purpose: 'coding_pr_write', isEnabled: () => !signal.aborted, assertCurrent: current, fetch }, signal);
                    if (!value)
                        return { ok: false as const, error: 'github_write_authority_unavailable' };
                    const fresh = await current();
                    fresh();
                    return { ok: true as const, ...value };
                }
                catch {
                    return { ok: false as const, error: 'github_write_authority_unavailable' };
                }
            } };
    }
    catch {
        return { ok: false, error: 'github_write_authority_unavailable' };
    }
}
async function captureCodingAuthority(organizationId: string, repository: RepoCoordinates, permissionProfile?: "contents_read"): Promise<CodingWriteAuthority> {
    try {
        if (!permissionProfile)
            await assertNoGovernanceEnrollmentForMutation(prisma, organizationId);
        const row = await prisma.gitHubInstallation.findFirst({ where: { organizationId, status: "active" }, orderBy: { installedAt: "desc" }, select: { id: true, githubInstallationId: true, updatedAt: true, revokedAt: true, suspendedAt: true } });
        if (!row || !row.id || !Number.isSafeInteger(Number(row.githubInstallationId)) || !/^[1-9][0-9]*$/.test(row.githubInstallationId) || !(row.updatedAt instanceof Date) || !Number.isFinite(row.updatedAt.getTime()) || row.revokedAt || row.suspendedAt)
            return { ok: false, error: "github_not_connected" };
        const id = row.id, githubInstallationId = row.githubInstallationId, version = row.updatedAt.getTime();
        const target = Object.freeze({ owner: repository.owner, repo: repository.repo });
        return Object.freeze({ ok: true, resolveToken: async () => {
                try {
                    if (!permissionProfile)
                        await assertNoGovernanceEnrollmentForMutation(prisma, organizationId);
                    const token = await resolveTenantScopedToken(organizationId, target, { id, githubInstallationId, updatedAt: new Date(version), ...(permissionProfile ? { permissionProfile } : {}) });
                    if (!permissionProfile)
                        await assertNoGovernanceEnrollmentForMutation(prisma, organizationId);
                    return token;
                }
                catch {
                    return { ok: false as const, error: "github_write_authority_unavailable" };
                }
            } });
    }
    catch {
        return { ok: false, error: "github_not_connected" };
    }
}
