import 'server-only';
import type { NextRequest } from 'next/server';
import type { ReleaseOperationPlanRepo, ReleaseOperationPlanTransaction as Tx } from '@/lib/agent/workflows/releaseOperationPlanStore';
import { hasDesktopCapability, type DesktopWorkspaceRole } from '@/lib/desktop/desktopAuthorization';
import { createGovernanceRequestAuthority } from './requestAuthority';
import { createGovernanceExecutionPolicyStore, type ExecutionPolicyRole } from './executionPolicyStore';
import type { RevisionScope } from './revisionStore';
/** Server-owned paired composition. No HTTP route, active baseline, execution
 * coverage, action approval or provider permission is created by these methods. */
export function createGovernanceExecutionPolicyRequestService(request: NextRequest, repo: ReleaseOperationPlanRepo, rawScope: RevisionScope, isEnabled: () => boolean) {
    const scope = structuredClone(rawScope), authority = createGovernanceRequestAuthority(request);
    function enabled() {
        request.signal.throwIfAborted();
        if (!isEnabled())
            throw Error('governance_intelligence_unavailable');
    }
    async function current(tx: Tx, s: RevisionScope, actor: {
        userId: string;
        sessionId: string;
    }, role: ExecutionPolicyRole) {
        enabled();
        if (s.organizationId !== scope.organizationId || s.actorUserId !== scope.actorUserId || s.sessionId !== scope.sessionId)
            throw Error('governance_execution_policy_identity_changed');
        if (actor.userId === scope.actorUserId) {
            if (actor.sessionId !== scope.sessionId)
                throw Error('governance_execution_policy_session_changed');
            await authority(tx, scope, role);
            enabled();
            return;
        }
        await authority(tx, scope, 'reader');
        const members = await tx.$queryRaw<Array<{
            organizationId: string;
            userId: string;
            role: string;
            acceptedAt: Date | null;
        }>> `SELECT "organizationId","userId","role","acceptedAt" FROM "OrgMembership" WHERE "organizationId"=${scope.organizationId} AND "userId"=${actor.userId} FOR SHARE`;
        const m = members[0], capability = role === 'policy_admin' ? 'policy:manage' : role === 'approver' ? 'agent:approve' : 'workspace:read';
        if (members.length !== 1 ||
            !m ||
            m.organizationId !== scope.organizationId ||
            m.userId !== actor.userId ||
            !m.acceptedAt ||
            !['owner', 'admin', 'operator', 'security_reviewer', 'finance_viewer', 'read_only'].includes(m.role) ||
            !hasDesktopCapability(m.role as DesktopWorkspaceRole, capability))
            throw Error('governance_execution_policy_principal_unavailable');
        const sessions = await tx.$queryRaw<Array<{
            id: string;
            organizationId: string;
            userId: string;
            live: boolean;
        }>> `SELECT "id","organizationId","userId",("revokedAt" IS NULL AND "expiresAt" > clock_timestamp()) AS "live" FROM "DesktopSessionRecord" WHERE "id"=${actor.sessionId} AND "organizationId"=${scope.organizationId} AND "userId"=${actor.userId} FOR SHARE`;
        const session = sessions[0];
        if (sessions.length !== 1 ||
            !session ||
            session.id !== actor.sessionId ||
            session.organizationId !== scope.organizationId ||
            session.userId !== actor.userId ||
            session.live !== true)
            throw Error('governance_execution_policy_session_unavailable');
        await authority(tx, scope, 'reader');
        enabled();
    }
    const store = createGovernanceExecutionPolicyStore(repo, { assertCurrent: current });
    return {
        lookupRequest: (operation: Parameters<typeof store.lookupRequest>[1], requestId: string) => { enabled(); return store.lookupRequest(scope, operation, requestId); },
        readActivePointer: (selection: Parameters<typeof store.readActivePointer>[1]) => { enabled(); return store.readActivePointer(scope, selection); },
        propose: (raw: unknown, requestId: string) => { enabled(); return store.propose(scope, raw, requestId); },
        readRevision: (id: string) => { enabled(); return store.readRevision(scope, id); },
        approve: (id: string, expectedVersion: number, digest: string, requestId: string) => { enabled(); return store.approve(scope, id, expectedVersion, digest, requestId); },
        activate: (id: string, expectedPointerVersion: number | null, parentDigest: string | null, requestId: string) => { enabled(); return store.activate(scope, id, expectedPointerVersion, parentDigest, requestId); },
        revoke: (id: string, expectedVersion: number, requestId: string) => { enabled(); return store.revoke(scope, id, expectedVersion, requestId); },
        readAuthority: (selection: Parameters<typeof store.readAuthority>[1], action: Parameters<typeof store.readAuthority>[2], expectedDigest?: string, tx?: Tx) => { enabled(); return store.readAuthority(scope, selection, action, expectedDigest, tx); },
    };
}
