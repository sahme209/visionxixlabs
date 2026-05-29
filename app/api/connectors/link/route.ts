import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkTieredRateLimit } from "@/lib/rateLimitTiered";
import {
  canViewTechnicalOutputs,
  canConnectCloud,
  hasEnterpriseEngagement,
  resolveEffectiveOperatorTier,
} from "@/lib/entitlements";
import { isCloudConnectorEnabled } from "@/lib/featureFlags";
import type { ConnectorType, ConnectorAuthMethod } from "@/lib/connectors/types";
import { validateGithubConnection } from "@/lib/connectors/github";
import { getConnector } from "@/lib/connectors/registry";
import { encryptCredential } from "@/lib/security/credentialVault";
import { logAudit } from "@/lib/security/auditLog";
import { eventConnectorLinked } from "@/lib/observability/events";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";

const VALID_CONNECTORS: ConnectorType[] = ["github", "aws", "azure", "gcp"];

/**
 * Phase 5: POST /api/connectors/link?token=
 * Link a connector. Store encrypted credential ref in fullPayload.connectors[connectorType].
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const userPlan = lead.userId
      ? (await prisma.user.findUnique({ where: { id: lead.userId }, select: { plan: true } }))?.plan ?? null
      : null;
    const tier = resolveEffectiveOperatorTier(payload.tier as string, userPlan);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
    if (!checkTieredRateLimit(tier, ip)) {
      return NextResponse.json({ error: "Too many requests. Please try again in a minute." }, { status: 429 });
    }
    const canPro = canViewTechnicalOutputs(tier);
    const canEnterprise = hasEnterpriseEngagement(tier);

    let body: {
      connectorType?: string;
      authMethod?: string;
      token?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      region?: string;
      roleArn?: string;
      roleName?: string;
      awsAccountId?: string;
      externalId?: string;
      tenantId?: string;
      clientId?: string;
      clientSecret?: string;
      subscriptionId?: string;
      projectId?: string;
      serviceAccountJson?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const connectorType = body.connectorType as ConnectorType | undefined;
    if (!connectorType || !VALID_CONNECTORS.includes(connectorType)) {
      return NextResponse.json({ error: "Invalid connectorType" }, { status: 400 });
    }

    if (connectorType !== "github" && !canConnectCloud(tier)) {
      return NextResponse.json({ error: "Cloud connectors are not available for your plan." }, { status: 403 });
    }

    if (connectorType !== "github" && !isCloudConnectorEnabled(connectorType as "aws" | "azure" | "gcp")) {
      return NextResponse.json(
        { error: `${connectorType.toUpperCase()} connector is not yet available. Coming soon.` },
        { status: 503 }
      );
    }

    // Rate limit connector link attempts per connector type and IP
    if (!checkRateLimit(`connector-link:${connectorType}:${ip}`)) {
      return NextResponse.json(
        { error: "Too many connector link attempts. Please try again later." },
        { status: 429 }
      );
    }

    const authMethod = (body.authMethod as ConnectorAuthMethod) || "token";
    let encryptedCredRef: string | undefined;

    if (connectorType === "github") {
      const cred = body.token?.trim();
      if (!cred) return NextResponse.json({ error: "token required for GitHub" }, { status: 400 });
      const validation = await validateGithubConnection(cred);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error || "Validation failed" }, { status: 400 });
      }
      encryptedCredRef = encryptCredential(cred);
    } else if (connectorType === "aws") {
      let roleArn = (body.roleArn ?? "").trim();
      const awsAccountId = String(body.awsAccountId ?? "").trim();
      const roleName = (body.roleName ?? "").trim();
      if (!roleArn && roleName && awsAccountId) {
        roleArn = `arn:aws:iam::${awsAccountId}:role/${roleName}`;
      }
      if (!roleArn || !awsAccountId) {
        return NextResponse.json(
          { error: "roleArn (or roleName + awsAccountId) and awsAccountId required for AWS" },
          { status: 400 }
        );
      }
      const awsInput = {
        roleArn,
        externalId: body.externalId?.trim() || null,
        region: body.region?.trim() || null,
        awsAccountId,
      };
      const connector = getConnector("aws");
      const validation = await connector.validateConnection(awsInput, {
        userId: lead.userId ?? lead.id,
        leadId: lead.id,
      });
      encryptedCredRef = encryptCredential(
        JSON.stringify({
          roleArn,
          externalId: awsInput.externalId || undefined,
          region: awsInput.region || undefined,
          awsAccountId,
        })
      );

      if (!validation.valid) {
        if (validation.status === "unavailable") {
          return NextResponse.json(
            { error: "AWS connector is not enabled in this environment" },
            { status: 503 }
          );
        }
        const connectors = (payload.connectors as Record<string, unknown>) || {};
        connectors.aws = {
          status: "invalid",
          linkedAt: new Date().toISOString(),
          authMethod: "assume-role",
          encryptedCredRef,
        };
        await prisma.lead.update({
          where: { id: lead.id },
          data: { fullPayload: { ...payload, connectors } as object },
        });
        return NextResponse.json(
          { error: "AWS connection could not be verified. Check Role ARN / External ID." },
          { status: 400 }
        );
      }

      const connectorsForAws = (payload.connectors as Record<string, unknown>) || {};
      connectorsForAws.aws = {
        status: "linked",
        linkedAt: new Date().toISOString(),
        authMethod: "assume-role",
        encryptedCredRef,
        verifiedAccountId: validation.account,
        verifiedCallerArn: validation.arn,
      };
      await prisma.lead.update({
        where: { id: lead.id },
        data: { fullPayload: { ...payload, connectors: connectorsForAws } as object },
      });

      // Bridge to the authenticated dashboard: derive the workspace id
      // from the lead's email (same hash currentContext() uses for the
      // session-based read), then upsert ConnectorSetupSession so the
      // dashboard's "Connect AWS" CTA flips to "Connected". The two
      // data models were previously disconnected — verified leads
      // didn't propagate to the org's connector state, so the user
      // would see "AWS verified" on /operator/onboarding and then
      // "Connect AWS" on /dashboard. This closes that gap.
      //
      // Note: the User model has no organizationId column — workspace
      // id is derived deterministically from email via the same SHA-256
      // prefix that currentContext() uses, so writes here and reads
      // from a session land on the same row.
      try {
        if (lead.userId && lead.email && lead.email !== "cloud-operator@placeholder.local") {
          const organizationId = deriveWorkspaceIdFromEmail(lead.email);
          await prisma.connectorSetupSession.upsert({
            where: {
              organizationId_provider: { organizationId, provider: "aws" },
            },
            update: {
              status: "connected",
              lastEventKind: "operator_onboarding_link",
              lastErrorCode: null,
              firstConnectedAt: new Date(),
              lastTransitionAt: new Date(),
            },
            create: {
              organizationId,
              provider: "aws",
              status: "connected",
              lastEventKind: "operator_onboarding_link",
              firstConnectedAt: new Date(),
              lastTransitionAt: new Date(),
            },
          });
        }
      } catch (err) {
        console.warn("[connectors/link] dashboard bridge failed:", err instanceof Error ? err.message : err);
      }

      await logAudit({ leadId: lead.id, action: "connector_linked", actor: "user", metadata: { connectorType } });
      eventConnectorLinked({ leadId: lead.id, connectorType });
      return NextResponse.json({ success: true, connectorType, status: "linked", account: validation.account });
    } else if (connectorType === "azure") {
      const connector = getConnector("azure");
      const validation = await connector.validateConnection(
        {
          tenantId: body.tenantId,
          clientId: body.clientId,
          clientSecret: body.clientSecret,
          subscriptionId: body.subscriptionId,
        },
        { userId: lead.userId ?? lead.id, leadId: lead.id }
      );
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error || "Validation failed" }, { status: 400 });
      }
      encryptedCredRef = encryptCredential(
        JSON.stringify({
          tenantId: body.tenantId,
          clientId: body.clientId,
          clientSecret: body.clientSecret,
          subscriptionId: body.subscriptionId,
        })
      );
    } else if (connectorType === "gcp") {
      const connector = getConnector("gcp");
      const validation = await connector.validateConnection(
        {
          projectId: body.projectId,
          serviceAccountJson: body.serviceAccountJson,
        },
        { userId: lead.userId ?? lead.id, leadId: lead.id }
      );
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error || "Validation failed" }, { status: 400 });
      }
      encryptedCredRef = encryptCredential(
        JSON.stringify({ projectId: body.projectId, serviceAccountJson: body.serviceAccountJson })
      );
    }

    if (!encryptedCredRef) {
      return NextResponse.json({ error: "Invalid state" }, { status: 500 });
    }

    const connectors = (payload.connectors as Record<string, unknown>) || {};
    connectors[connectorType] = {
      status: "linked",
      linkedAt: new Date().toISOString(),
      authMethod,
      encryptedCredRef,
    };

    await prisma.lead.update({
      where: { id: lead.id },
      data: { fullPayload: { ...payload, connectors } as object },
    });

    await logAudit({ leadId: lead.id, action: "connector_linked", actor: "user", metadata: { connectorType } });
    eventConnectorLinked({ leadId: lead.id, connectorType });

    return NextResponse.json({ success: true, connectorType, status: "linked" });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const redacted = raw
      .replace(/\bAKIA[A-Z0-9]{16}\b/g, "[REDACTED]")
      .replace(/\b[A-Za-z0-9/+=]{40}\b/g, "[REDACTED]")
      .replace(/roleArn[=:]\s*[^\s,}]+/gi, "roleArn=[REDACTED]")
      .replace(/externalId[=:]\s*[^\s,}]+/gi, "externalId=[REDACTED]");
    console.error("[connectors link]", redacted);
    return NextResponse.json({ error: "Failed to link connector" }, { status: 500 });
  }
}
