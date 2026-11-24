import "server-only";

import {createHash} from "node:crypto";
import {prisma} from "@/lib/db";
import type {Prisma} from "@/lib/prismaClient";
import type {IncidentRecord} from "@/lib/incidents/incidentResponseModel";
import type {TelemetrySignal} from "@/lib/telemetry/telemetryIngestModel";

type Observation = {telemetry: TelemetrySignal; incident: IncidentRecord};
type Lane = keyof Observation;

export const MAX_INBOUND_OBSERVATIONS = 500;
export const MAX_INBOUND_BODY_BYTES = 256_000;

export async function storeInboundObservations<L extends Lane>(
  organizationId: string, lane: L, provider: string, body: string, observations: readonly Observation[L][],
): Promise<number> {
  const deliveryDigest = createHash("sha256").update(body).digest("hex");
  const {count} = await prisma.inboundObservation.createMany({
    data: observations.map((record, ordinal) => ({
      organizationId, lane, provider, deliveryDigest, ordinal,
      evidence: record as unknown as Prisma.InputJsonObject,
    })),
    skipDuplicates: true,
  });
  return count;
}

export async function readInboundObservations<L extends Lane>(
  organizationId: string, lane: L,
): Promise<{available: true; observations: Observation[L][]} | {available: false; observations: []}> {
  try {
    const rows = await prisma.inboundObservation.findMany({
      where: {organizationId, lane},
      orderBy: [{receivedAt: "desc"}, {id: "desc"}],
      take: MAX_INBOUND_OBSERVATIONS,
      select: {evidence: true},
    });
    return {available: true, observations: rows.map(row => row.evidence as unknown as Observation[L])};
  } catch {
    return {available: false, observations: []};
  }
}
