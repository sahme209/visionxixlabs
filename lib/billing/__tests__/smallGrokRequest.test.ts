import {afterEach,expect,it,vi} from "vitest";
import fixture from "./fixtures/grokPricing20261023.json";
import {prepareSmallSonnetRequest} from "../smallSonnetRequest";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("does not treat the advertised Grok cap as proof after contradictory real usage",async()=>{
 vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY","axiom_public_anniversary_v1");vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS","");const fetcher=vi.fn(async()=>new Response(JSON.stringify(fixture)));vi.stubGlobal("fetch",fetcher);
 expect(fixture.data.endpoints[0].supported_parameters).toContain("max_tokens");
 expect(await prepareSmallSonnetRequest({organizationId:"fixture",userId:"member",correlationId:"rejected"},{model:fixture.data.id,text:"List environments",schemaHint:"{action:string}"})).toBeUndefined();expect(fetcher).not.toHaveBeenCalled();
});
