import "server-only";
import {z} from "zod";
import {prisma} from "@/lib/db";
import {Prisma} from "@/lib/prismaClient";
import {incidentTriagePriority,type IncidentResponseTarget} from "@/lib/tauri/ticketDirectoryContract";
import {INCIDENT_TRIAGE_ENGINE_VERSION,triageResponseDeadline} from "./incidentTriageEngine";

const instant = z.string().datetime();
const target = z.object({
  incidentId:z.string(),releaseId:z.string(),reportedAt:instant,generatedAt:instant,deadline:instant,
}).strict();

interface ScopedIncident {id:string;releaseId:string;reportedAtIso:string}
interface TriageTargetRow {
  organizationId:string;
  incidentId:string;
  priority:string;
  operatorDecision:string;
  overridePriority:string|null;
  decidedAt:Date|null;
  decidedByUserId:string|null;
  engineVersion:string;
  generatedAt:Date;
  target:unknown;
}

export async function incidentResponseTargets(organizationId:string, incidents:ScopedIncident[]) {
  const values = new Map<string,IncidentResponseTarget>();
  if (!incidents.length) return values;
  const byId = new Map(incidents.map(incident => [incident.id,incident]));
  const rows = await prisma.$queryRaw<TriageTargetRow[]>`
    SELECT DISTINCT ON ("incidentId")
      "organizationId","incidentId","priority","operatorDecision","overridePriority","decidedAt","decidedByUserId","engineVersion",
      "generatedAt","inputsJson"->'responseTarget' AS "target"
    FROM "IncidentTriage"
    WHERE "organizationId" = ${organizationId} AND "incidentId" IN (${Prisma.join([...byId.keys()])})
    ORDER BY "incidentId","generatedAt" DESC,"id" DESC`;
  for (const row of rows) {
    const incident = byId.get(row.incidentId);
    const parsed = target.safeParse(row.target);
    const priority = incidentTriagePriority.safeParse(row.priority);
    if (!incident || row.organizationId !== organizationId || row.engineVersion !== INCIDENT_TRIAGE_ENGINE_VERSION ||
        !parsed.success || !priority.success) continue;
    const data = parsed.data;
    const generatedAt = new Date(data.generatedAt);
    if (data.incidentId !== incident.id || data.releaseId !== incident.releaseId || data.reportedAt !== incident.reportedAtIso ||
        generatedAt < new Date(data.reportedAt) || generatedAt.getTime() !== row.generatedAt.getTime() ||
        data.deadline !== triageResponseDeadline(priority.data,generatedAt)) continue;
    if (row.operatorDecision === "pending") {
      if (!row.decidedAt && !row.overridePriority) values.set(incident.id,{deadline:data.deadline,priority:priority.data,decision:"suggested"});
      continue;
    }
    if (!row.decidedByUserId || !row.decidedAt || row.decidedAt < row.generatedAt) continue;
    if (row.operatorDecision === "accepted" && !row.overridePriority) {
      values.set(incident.id,{deadline:data.deadline,priority:priority.data,decision:"accepted"});
    } else if (row.operatorDecision === "overridden") {
      const override = incidentTriagePriority.safeParse(row.overridePriority);
      if (override.success) values.set(incident.id,{
        deadline:triageResponseDeadline(override.data,generatedAt),priority:override.data,decision:"overridden",
      });
    }
  }
  return values;
}
