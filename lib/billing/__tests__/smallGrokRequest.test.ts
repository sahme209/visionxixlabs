import {afterEach,beforeEach,expect,it,vi} from "vitest";
import fixture from "./fixtures/grokPricing20261023.json";
import {prepareSmallSonnetRequest,smallSonnetReservation,smallSonnetReservationEvidence,authorizeSmallSonnetDispatch,consumeSmallSonnetDispatch,smallSonnetPayload} from "../smallSonnetRequest";
const scope={organizationId:"owned-fixture",userId:"member",correlationId:"grok-test:0"};
const request={model:"spacexai/grok-4.20-multi-agent",text:"x".repeat(12000),schemaHint:"{action:string}"};
let metadata:typeof fixture;let transport:ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.stubEnv("AXIOM_PUBLIC_BILLING_POLICY","axiom_public_anniversary_v1");vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS","");metadata=structuredClone(fixture);transport=vi.fn(async()=>new Response(JSON.stringify(metadata)));vi.stubGlobal("fetch",transport);});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function quote(){const q=await prepareSmallSonnetRequest(scope,request);expect(q).toBeDefined();return q!;}
it("prices the complete bounded Grok payload including every published service tier without a fixed ten-dollar hold",async()=>{
 const q=await quote();expect(smallSonnetReservation(q,scope)).toBeGreaterThan(0);expect(smallSonnetReservation(q,scope)).toBeLessThanOrEqual(100);
 expect(smallSonnetReservationEvidence(q,scope)).toMatchObject({policy:"small_grok_free_v1",model:request.model,maximumPayloadBytes:16384,maximumOutputTokens:1024});
 expect(transport).toHaveBeenCalledWith("https://ai-gateway.vercel.sh/v1/models/spacexai/grok-4.20-multi-agent/endpoints",expect.objectContaining({cache:"no-store"}));
 const dispatch=authorizeSmallSonnetDispatch(q,{...scope,...request,maxTokens:1024});
 expect(consumeSmallSonnetDispatch(dispatch,{...scope,model:request.model,...smallSonnetPayload(request.text,request.schemaHint),maxTokens:1024})).toEqual({gateway:{only:["xai"]}});
 expect(()=>consumeSmallSonnetDispatch(dispatch,{...scope,model:request.model,...smallSonnetPayload(request.text,request.schemaHint),maxTokens:1024})).toThrow();
});
it("cannot change a Grok quote into a Sonnet dispatch",async()=>{const q=await quote();expect(()=>authorizeSmallSonnetDispatch(q,{...scope,...request,model:"anthropic/claude-sonnet-5",maxTokens:1024})).toThrow();});
it.each(["unsupported_model","new_fee","unbounded_output","different_provider","duplicate_provider","unpriced_service_tier"])("refuses unverified Grok pricing or route: %s",async kind=>{
 if(kind==="unsupported_model")metadata.data.id="spacexai/grok-other";
 if(kind==="new_fee")Object.assign(metadata.data.endpoints[0].pricing,{unrecognized_fee:"0.01"});
 if(kind==="unbounded_output")metadata.data.endpoints[0].supported_parameters=[];
 if(kind==="different_provider")metadata.data.endpoints[0].provider_name="other";
 if(kind==="duplicate_provider")metadata.data.endpoints.push(metadata.data.endpoints[0]);
 if(kind==="unpriced_service_tier")Object.assign(metadata.data.endpoints[0].pricing.service_tiers,{unknown:{request:"1"}});
 expect(await prepareSmallSonnetRequest(scope,request)).toBeUndefined();
});
it("retains an explicit operator hold override",async()=>{vi.stubEnv("AXIOM_AI_MAX_REQUEST_CREDITS_CENTS","1000");expect(await prepareSmallSonnetRequest(scope,request)).toBeUndefined();expect(transport).not.toHaveBeenCalled();});

it("does not clip a quote whose required exposure exceeds one dollar",async()=>{metadata.data.endpoints[0].pricing.service_tiers.priority.long_context.prompt="0.001";expect(await prepareSmallSonnetRequest(scope,request)).toBeUndefined();});
it("burns a Grok admission if its SDK output bound changes",async()=>{const q=await quote();expect(()=>authorizeSmallSonnetDispatch(q,{...scope,...request,maxTokens:4096})).toThrow();expect(()=>authorizeSmallSonnetDispatch(q,{...scope,...request,maxTokens:1024})).toThrow();});
it("does not silently translate a different Grok identifier",async()=>{expect(await prepareSmallSonnetRequest(scope,{...request,model:"xai/grok-4.20-multi-agent"})).toBeUndefined();expect(transport).not.toHaveBeenCalled();});
