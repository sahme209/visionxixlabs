import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { checkTieredRateLimit } from "@/lib/rateLimitTiered";
import {
  canViewTechnicalOutputs,
  hasEnterpriseEngagement,
  resolveEffectiveOperatorTier,
} from "@/lib/entitlements";
import type { ConnectorType, ConnectorAuthMethod } from "@/lib/connectors/types";
import { validateGithubConnection } from "@/lib/connectors/github";
import { validateAwsConnection } from "@/lib/connectors/aws";
import { validateAzureConnection } from "@/lib/connectors/azure";
import { validateGcpConnection } from "@/lib/connectors/gcp";
import { encryptCredential } from "@/lib/security/credentialVault";
import { logAudit } from "@/lib/security/auditLog";
import { eventConnectorLinked } from "@/lib/observability/events";

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

    if (connectorType !== "github" && !canPro) {
      return NextResponse.json({ error: "Cloud connectors (AWS, Azure, GCP) require Growth or higher membership. Upgrade at /visionxix-ai/pricing" }, { status: 403 });
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
      const validation = validateAwsConnection({
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
        region: body.region,
      });
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error || "Validation failed" }, { status: 400 });
      }
      encryptedCredRef = encryptCredential(
        JSON.stringify({ accessKeyId: body.accessKeyId, secretAccessKey: body.secretAccessKey, region: body.region })
      );
    } else if (connectorType === "azure") {
      const validation = validateAzureConnection({
        tenantId: body.tenantId,
        clientId: body.clientId,
        clientSecret: body.clientSecret,
        subscriptionId: body.subscriptionId,
      });
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
      const validation = validateGcpConnection({
        projectId: body.projectId,
        serviceAccountJson: body.serviceAccountJson,
      });
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error || "Validation failed" }, { status: 400 });
      }
      encryptedCredRef = encryptCredential(
        JSON.stringify({ projectId: body.projectId, serviceAccountJson: body.serviceAccountJson })
      );
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
    console.error("[connectors link]", e);
    return NextResponse.json({ error: "Failed to link connector" }, { status: 500 });
  }
}
