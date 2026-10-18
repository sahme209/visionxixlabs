import { expect, it, vi } from "vitest";
import { readCustomerPlanStorageReadiness, readCurrentCustomerProfile, CUSTOMER_PLAN_PROPOSAL_CHECKSUM } from "../customerPlanStore";
import { bytesDigest } from "../savedPlanArtifact";
import { readFileSync } from "node:fs";
import syntheticCatalog from "./customerPlanCatalog.synthetic.json";
it("pins review-only SQL bytes without an automatic marker or migration", () => {
 const source = readFileSync("docs/proposals/terraform-customer-plan-producer-v2.sql");
 expect(bytesDigest(source)).toBe(CUSTOMER_PLAN_PROPOSAL_CHECKSUM);
 expect(source.toString()).not.toContain('INSERT INTO "TerraformCustomerPlanFeature"');
});
it("fails closed before querying absent customer columns", async () => {
 const query = vi.fn().mockResolvedValue([{ feature:false,profile:false,current:false,provenance:false }]);
 expect(await readCustomerPlanStorageReadiness({ $queryRawUnsafe:query })).toBe("not_installed");
 expect(query).toHaveBeenCalledTimes(1);
});
it("rejects partial storage and unmarked customer tables", async () => {
 const query = vi.fn().mockResolvedValue([{ feature:true,profile:true,current:false,provenance:true }]);
 expect(await readCustomerPlanStorageReadiness({ $queryRawUnsafe:query })).toBe("drift");
 expect(query).toHaveBeenCalledTimes(1);
 const unmarked = vi.fn().mockResolvedValueOnce([{ feature:true,profile:true,current:true,provenance:true }]).mockResolvedValueOnce([]);
 expect(await readCustomerPlanStorageReadiness({ $queryRawUnsafe:unmarked })).toBe("drift");
});
it("never grants readiness on provider/query failures or a forged marker alone", async () => {
 expect(await readCustomerPlanStorageReadiness({ $queryRawUnsafe:vi.fn().mockRejectedValue(Error("missing")) })).toBe("unavailable");
 const query = vi.fn().mockResolvedValueOnce([{feature:true,profile:true,current:true,provenance:true}]).mockResolvedValueOnce([{version:2,proposalChecksum:CUSTOMER_PLAN_PROPOSAL_CHECKSUM}]).mockResolvedValueOnce([{columns:[],constraints:[],functions:[],triggers:[]}]);
 expect(await readCustomerPlanStorageReadiness({ $queryRawUnsafe:query })).toBe("drift");
});
it("loads only the bound tenant/request profile with SQL parameters and no mutation", async () => {
 const query = vi.fn().mockResolvedValue([]);
 expect(await readCurrentCustomerProfile({ $queryRawUnsafe:query },{organizationId:"foreign' OR 1=1",requestId:"request"})).toBeNull();
 expect(query.mock.calls[0][0]).toContain('c."organizationId"=$1 AND c."deploymentRequestId"=$2');
 expect(query.mock.calls[0][0]).not.toMatch(/INSERT|UPDATE|DELETE/);
 expect(query.mock.calls[0].slice(1)).toEqual(["foreign' OR 1=1","request"]);
});

it("recognizes only the expected synthetic shape, without claiming real PostgreSQL catalog acceptance", async () => {
 const query=vi.fn().mockResolvedValueOnce([{feature:true,profile:true,current:true,provenance:true}]).mockResolvedValueOnce([{version:2,proposalChecksum:CUSTOMER_PLAN_PROPOSAL_CHECKSUM}]).mockResolvedValueOnce([syntheticCatalog.catalog]);
 expect(await readCustomerPlanStorageReadiness({$queryRawUnsafe:query})).toBe("ready");
});
it.each(["columns","constraints","functions","triggers"] as const)("rejects changed synthetic catalog %s", async field => {
 const catalog=structuredClone(syntheticCatalog.catalog);
 if(field==="columns")catalog.columns.pop();
 if(field==="constraints")catalog.constraints.tfcp_profile_revision="CHECK (revision >= 0)";
 if(field==="functions")catalog.functions.axiom_customer_plan_profile_guard_v2="BEGIN RETURN NEW; END";
 if(field==="triggers")catalog.triggers[0]=catalog.triggers[0].replace(":31:O:",":31:D:");
 const query=vi.fn().mockResolvedValueOnce([{feature:true,profile:true,current:true,provenance:true}]).mockResolvedValueOnce([{version:2,proposalChecksum:CUSTOMER_PLAN_PROPOSAL_CHECKSUM}]).mockResolvedValueOnce([catalog]);
 expect(await readCustomerPlanStorageReadiness({$queryRawUnsafe:query})).toBe("drift");
});
it("proposes an immutable provenance guard that requires the exact active current profile", () => {
 const sql=readFileSync("docs/proposals/terraform-customer-plan-producer-v2.sql","utf8");
 const body=sql.split("CREATE FUNCTION axiom_customer_plan_provenance_guard_v2()")[1].split("END $$;")[0];
 expect(body).toContain('"TerraformCustomerPlanCurrent" c');
 expect(body).toContain('c."revision"=NEW."profileRevision"');
 expect(body).toContain('c."status"=\'active\'');
});
