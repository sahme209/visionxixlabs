import {expect,it} from "vitest";
import {AccountedDecisionMalformed} from "../accountedDecisionMalformed";

it("carries only immutable bounded numeric usage, with fixed parser diagnostics",()=>{
  const error=new AccountedDecisionMalformed({promptTokens:0,completionTokens:3,totalTokens:3});
  expect(error).toBeInstanceOf(SyntaxError);
  expect(error.message).toBe("accounted_agent_decision_malformed");
  expect(error.usage).toEqual({promptTokens:0,completionTokens:3,totalTokens:3});
  expect(Object.isFrozen(error.usage)).toBe(true);
});
it.each([NaN,Infinity,-1,0.5,Number.MAX_SAFE_INTEGER+1])("drops invalid usage evidence %s",value=>{
  const error=new AccountedDecisionMalformed({promptTokens:value,completionTokens:2,totalTokens:value});
  expect(error.usage).toEqual({promptTokens:undefined,completionTokens:2,totalTokens:undefined});
});
