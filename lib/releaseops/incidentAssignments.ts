import "server-only";
import {prisma} from "@/lib/db";
import {canChangeIncidentStatus} from "@/lib/tauri/incidentTransitionContract";
import type {IncidentOwner} from "@/lib/tauri/incidentAssignmentContract";

export async function assignmentCandidates(organizationId:string, userIds?:string[], take?:number) {
  const members = await prisma.orgMembership.findMany({
    where:{organizationId,acceptedAt:{not:null},role:{in:["owner","admin","operator"]},
      ...(userIds && {userId:{in:userIds}})},
    select:{userId:true,organizationId:true,role:true,acceptedAt:true},orderBy:{userId:"asc"},take,
  });
  const eligible = members.filter(member => member.organizationId === organizationId && member.acceptedAt &&
    canChangeIncidentStatus(member.role) && (!userIds || userIds.includes(member.userId)));
  const users = eligible.length ? await prisma.user.findMany({
    where:{id:{in:eligible.map(member => member.userId)}},select:{id:true,name:true},
  }) : [];
  const names = new Map(users.map(user => [user.id,user.name?.trim().slice(0,120)]));
  return eligible.map(member => ({
    userId:member.userId,displayName:names.get(member.userId) || `Workspace member · ${member.userId.slice(-8)}`,
  }));
}

export async function incidentOwners(organizationId:string, incidentIds:string[]) {
  const result = new Map<string,IncidentOwner>();
  if (!incidentIds.length) return result;
  const records = await prisma.deploymentIncidentAssignment.findMany({
    where:{organizationId,incidentId:{in:incidentIds}},select:{organizationId:true,incidentId:true,ownerUserId:true},
  });
  if (records.some(record => record.organizationId !== organizationId || !incidentIds.includes(record.incidentId))) {
    throw Error("Assignment scope mismatch");
  }
  const ownerIds = [...new Set(records.flatMap(record => record.ownerUserId ?? []))];
  const members = new Map((ownerIds.length ? await assignmentCandidates(organizationId,ownerIds) : [])
    .map(member => [member.userId,member]));
  const byIncident = new Map(records.map(record => [record.incidentId,record.ownerUserId]));
  for (const incidentId of incidentIds) {
    const ownerId = byIncident.get(incidentId);
    const member = ownerId && members.get(ownerId);
    result.set(incidentId, member ? {state:"assigned",...member} : ownerId ? {state:"unavailable"} : {state:"unassigned"});
  }
  return result;
}
