import {describe,it,expect} from "vitest";
import {aiUsageText} from "../../desktop/src/lib/aiUsageText";
describe("provider token evidence",()=>{
 it("retains total-only reports",()=>expect(aiUsageText({inputTokens:null,outputTokens:null,totalTokens:1234})).toBe("1,234 total tokens"));
 it("does not call absent evidence zero",()=>expect(aiUsageText({inputTokens:null,outputTokens:null,totalTokens:null})).toBe("Token counts were not reported by the provider."));
 it("preserves a reported zero and labels missing breakdown",()=>expect(aiUsageText({inputTokens:0,outputTokens:null,totalTokens:null})).toBe("0 input · Not reported output tokens"));
 it("does not estimate totals from a breakdown",()=>expect(aiUsageText({inputTokens:10,outputTokens:5,totalTokens:null})).toBe("10 input · 5 output tokens"));
 it("rejects invalid counts",()=>expect(aiUsageText({inputTokens:-1,outputTokens:NaN,totalTokens:1.5})).toBe("Token counts were not reported by the provider."));
});
