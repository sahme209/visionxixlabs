import {expect,it,vi} from "vitest";
import {authorityFixture} from "./customerPlanAuthorityFixtures";
import {loadCustomerPlanAuthorityRows} from "../customerPlanRepository";
import type {SavedPlanDatabase} from "../savedPlanStore";
function fixture(){
 const f=authorityFixture();
 const db={$queryRawUnsafe:vi.fn(async(sql:string,...values:unknown[])=>{
  const table=/FROM public\."([^"]+)"/.exec(sql)?.[1];
  const names={DesktopSessionRecord:"device",OrgMembership:"membership",TauriDeploymentRequest:"request",TauriDeploymentRequestVersion:"version",Environment:"environment",Repository:"repository",GitHubInstallation:"installation",CloudAccount:"account",CloudAccountCredential:"credential",AxiomApprovalPolicy:"policy"} as const;
  const name=names[table as keyof typeof names];if(!name)throw Error("unexpected owned query");
  expect(values).toContain(f.principal.organizationId);const row=f.rows[name];return row?[structuredClone(row)]:[];
 })};
 return {...f,db,typedDb:db as unknown as SavedPlanDatabase};
}
it("loads only named canonical columns with tenant predicates and optional locks before a final-context decision",async()=>{
 const f=fixture(),rows=await loadCustomerPlanAuthorityRows(f.typedDb,f.principal,f.profile,{operation:"import",now:f.now,lock:true});
 expect(rows).toEqual(f.rows);expect(f.db.$queryRawUnsafe).toHaveBeenCalledTimes(9);
 for(const [sql] of f.db.$queryRawUnsafe.mock.calls){expect(sql).toContain("FOR UPDATE");expect(sql).not.toContain("SELECT *");expect(sql).not.toContain("encryptedConfiguration");expect(sql).not.toContain("INSERT");}
});
it("keeps the admission read unlocked and snapshots returned rows rather than retaining adapter objects",async()=>{
 const f=fixture(),rows=await loadCustomerPlanAuthorityRows(f.typedDb,f.principal,f.profile,{operation:"read",now:f.now});
 expect(rows).not.toBeNull();f.rows.account.regions.push("us-west-2");expect(rows?.account.regions).toEqual(["us-east-1"]);expect(f.db.$queryRawUnsafe.mock.calls.every(([sql])=>!sql.includes("FOR UPDATE"))).toBe(true);
});
it("refuses cross-tenant profile selectors before even canonical row IO",async()=>{
 const f=fixture();f.profile.organizationId="foreign";expect(await loadCustomerPlanAuthorityRows(f.typedDb,f.principal,f.profile,{operation:"import",now:f.now})).toBeNull();expect(f.db.$queryRawUnsafe).not.toHaveBeenCalled();
});
it.each(["demoted","removed","revoked","expired"])("refuses %s actor before target/connection lookup",async mode=>{
 const f=fixture();if(mode==="demoted")f.rows.membership.role="operator";if(mode==="removed")f.rows.membership.acceptedAt=null;if(mode==="revoked")f.rows.device.revokedAt=f.now;if(mode==="expired")f.rows.device.expiresAt=f.now;
 expect(await loadCustomerPlanAuthorityRows(f.typedDb,f.principal,f.profile,{operation:"import",now:f.now})).toBeNull();expect(f.db.$queryRawUnsafe.mock.calls.every(([sql])=>sql.includes('public."DesktopSessionRecord"')||sql.includes('public."OrgMembership"'))).toBe(true);
});
it("loads a selected policy in the same tenant and lock discipline without treating it as plan approval",async()=>{
 const f=fixture();f.rows.environment.approvalPolicyId="policy-owned";f.rows.policy={id:"policy-owned",organizationId:f.principal.organizationId,enabled:true,blockAction:true,updatedAt:f.now};
 const rows=await loadCustomerPlanAuthorityRows(f.typedDb,f.principal,f.profile,{operation:"import",now:f.now,lock:true});expect(rows?.policy).toEqual(f.rows.policy);expect(f.db.$queryRawUnsafe).toHaveBeenCalledTimes(10);
 expect(f.db.$queryRawUnsafe.mock.calls.find(([sql])=>sql.includes('public."AxiomApprovalPolicy"'))?.[1]).toBe(f.principal.organizationId);
});
