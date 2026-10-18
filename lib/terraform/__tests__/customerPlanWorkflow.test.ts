import {readFileSync,existsSync} from "node:fs";
import path from "node:path";
import {expect,it} from "vitest";
const file=path.resolve("docs/templates/customer-terraform-plan.yml.disabled");
it("keeps protected manual CI outside active workflows with exact reviewed action pins and fixed helper",()=>{
 const text=readFileSync(file,"utf8");expect(text).toContain("workflow_dispatch:");expect(text).toContain("environment: terraform-plan-review");expect(text).toContain("node scripts/terraform/customer-plan-producer.mjs");
 expect(text).toContain("persist-credentials: false");expect(text).toContain("cancel-in-progress: false");expect(text).toContain("attestations: write");
 const pins=[...text.matchAll(/uses:\s*([^\s]+)@([^\s#]+)/g)];expect(pins).toHaveLength(2);expect(pins.every(p=>/^[a-f0-9]{40}$/.test(p[2]))).toBe(true);
 expect(existsSync(path.resolve(".github/workflows/customer-terraform-plan.yml"))).toBe(false);
 expect(text).not.toMatch(/workflow_call:|push:|pull_request:|workflow_run:|upload-artifact@|configure-aws-credentials@|setup-terraform@|push-to-registry:\s*true/);
});
it("attests exactly the three private tuple subjects and cleans only the fixed owned output directory",()=>{
 const text=readFileSync(file,"utf8");
 for(const name of ["plan.tfplan","plan.show.json","plan.receipt.json"])expect(text).toContain(`axiom-customer-plan/${name}`);
 expect(text).toContain("if: always()");expect(text).toContain("process.env.RUNNER_TEMP");
 expect(text).not.toContain("terraform apply");expect(text).not.toContain("workflow_dispatch(");
});
