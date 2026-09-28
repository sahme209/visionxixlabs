import "server-only";

import { prisma } from "@/lib/db";

export interface DesktopRuntimeReadiness {
  ready: boolean;
  message?: string;
}

/**
 * Distribution readiness is more than a published installer. These reads
 * prove that the production data plane has the tables required for first
 * sign-in, entitlement evaluation, and the request-to-playbook journey.
 * Any uncertainty fails closed without disclosing schema details publicly.
 */
export async function readDesktopRuntimeReadiness(): Promise<DesktopRuntimeReadiness> {
  try {
    await Promise.all([
      prisma.desktopPairingChallengeRecord.findFirst({ select: { id: true } }),
      prisma.desktopSessionRecord.findFirst({ select: { id: true } }),
      prisma.tenantBillingPlan.findFirst({ select: { id: true } }),
      prisma.tauriDeploymentRequest.findFirst({ select: { id: true } }),
      prisma.tauriPlaybook.findFirst({ select: { id: true } }),
    ]);
    return { ready: true };
  } catch (error) {
    console.error("[DesktopRuntimeReadiness] Required production storage is unavailable", error);
    return {
      ready: false,
      message: "Installers are built, but new desktop sign-in is temporarily unavailable while production storage is being prepared.",
    };
  }
}
