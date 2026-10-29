import type {AITextResponse} from "./AIProvider";

/** Only constructed after an admitted response's usage has been recorded.
 * Keep numeric usage for the turn receipt; never retain raw model output,
 * provider metadata, parser diagnostics, or an upstream exception. */
export class AccountedDecisionMalformed extends SyntaxError {
  readonly usage: AITextResponse["usage"];

  constructor(usage: AITextResponse["usage"]) {
    super("accounted_agent_decision_malformed");
    this.name = "AccountedDecisionMalformed";
    const count = (value: unknown): number | undefined =>
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
    this.usage = usage ? Object.freeze({
      promptTokens: count(usage.promptTokens),
      completionTokens: count(usage.completionTokens),
      totalTokens: count(usage.totalTokens),
    }) : null;
  }
}
