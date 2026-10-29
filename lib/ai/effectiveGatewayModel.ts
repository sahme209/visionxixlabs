/** Match manager nullish precedence, then Gateway's absent/sentinel default.
 * Pin the returned concrete value in dispatch options after checking it, so an
 * admission await cannot switch the request to a different configured default.
 */
export function effectiveGatewayModel(input: { model?: string; modelSelection?: string; defaultModel?: string }): string | undefined {
  const selected = input.model ?? input.modelSelection;
  return selected && selected !== "service-default" ? selected : input.defaultModel;
}

/** Aggregate multi-agent output exceeded the requested cap in live acceptance.
 * Workspace approval does not establish an enforceable output/financial bound.
 */
export function gatewayModelOutputBoundVerified(model: string | undefined): model is string {
  return Boolean(model && model !== "service-default" && !/(?:^|\/)grok-4\.20-multi-agent(?:$|[-:])/.test(model));
}
