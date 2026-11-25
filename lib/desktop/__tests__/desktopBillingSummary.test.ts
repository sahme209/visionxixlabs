import {describe,expect,it} from "vitest";
import {parseDesktopUsageSummary} from "../desktopBillingSummary";
const usage=()=>({periodMonth:"2026-10",aiInvocationCount:1,aiInputTokens:5,aiOutputTokens:7,aiCostCents:1});
const snapshot=()=>({version:1,canManageBilling:false,plan:{available:true,label:"Free",status:"active",publicPlanId:"free",hasCustomer:false},allowance:{available:true,baseCents:200,addOnCents:0,poolCents:200,usedCents:1,heldCents:0,includedRemainingCents:199,overagePolicy:"block"}});
describe("desktop billing response boundary",()=>{
 it("accepts an older usage response without inventing billing evidence",()=>expect(parseDesktopUsageSummary(usage())).toEqual(usage()));
 it("copies only the public billing snapshot",()=>{
  const value={...usage(),billingSnapshot:{...snapshot(),privateCredential:"secret"}};
  expect(parseDesktopUsageSummary(value)?.billingSnapshot).toEqual(snapshot());
  expect(JSON.stringify(parseDesktopUsageSummary(value))).not.toContain("secret");
 });
 it.each([null,{}, {...usage(),periodMonth:"2026-13"},{...usage(),aiCostCents:-1},{...usage(),aiInvocationCount:NaN},{...usage(),aiInputTokens:Number.MAX_SAFE_INTEGER+1}])("rejects malformed usage %#",value=>expect(parseDesktopUsageSummary(value)).toBeNull());
 it.each([
  {...snapshot(),version:2}, {...snapshot(),canManageBilling:"true"},
  {...snapshot(),plan:{...snapshot().plan,label:""}}, {...snapshot(),plan:{...snapshot().plan,status:"approved"}},
  {...snapshot(),plan:{...snapshot().plan,publicPlanId:"premium"}}, {...snapshot(),plan:{...snapshot().plan,hasCustomer:1}},
  {...snapshot(),allowance:{...snapshot().allowance,includedRemainingCents:-1}},
  {...snapshot(),allowance:{...snapshot().allowance,heldCents:0.5}},
 ])("fails closed for a malformed present extension %#",billingSnapshot=>expect(parseDesktopUsageSummary({...usage(),billingSnapshot})).toBeNull());
 it("keeps a verified zero cap distinct from an unset or invalid budget", () => {
  const limit = { monthlyLimitCents: 0, remainingCents: 0, warningReached: false };
  function parse(limitValue: typeof limit | null, canManageBilling = true) {
    return parseDesktopUsageSummary({
      ...usage(),
      billingSnapshot: { ...snapshot(), canManageBilling, budget: { available: true, limit: limitValue } },
    })?.billingSnapshot;
  }
  expect(parse(limit)?.budget).toEqual({ available: true, limit });
  expect(parse(null)?.budget).toEqual({ available: true, limit: null });
  expect(parse({ ...limit, remainingCents: 1 })).toMatchObject({
    budget: { available: false },
    allowance: { available: true, includedRemainingCents: 199 },
  });
  expect(parse(limit, false)?.budget).toBeUndefined();
 });
 it("preserves explicit unavailability instead of synthesizing zero credit",()=>{
  const billingSnapshot={version:1,canManageBilling:false,plan:{available:false},allowance:{available:false}};
  expect(parseDesktopUsageSummary({...usage(),billingSnapshot})?.billingSnapshot).toEqual(billingSnapshot);
 });
});
