export function starterGenerationActive(payload: Record<string, unknown>) {
  const engine = payload.starterEngine as { runId?: unknown; dispatchState?: unknown } | undefined;
  return typeof engine?.runId === "string" && Boolean(engine.runId) &&
    ["reserved", "started", "outcome_unconfirmed", "result_staged"].includes(String(engine.dispatchState));
}

export function stagedLeadResult(payload: Record<string, unknown>, key = "engine") {
  const engine = payload[key] as {
    engineName?: unknown; dispatchState?: unknown; runId?: unknown;
    stagedResult?: { runId?: unknown; inputHash?: unknown; patch?: unknown };
  } | undefined;
  const stage = engine?.stagedResult;
  if (engine?.dispatchState !== "result_staged" || typeof engine.runId !== "string" ||
      !engine.runId || typeof engine.engineName !== "string" || !stage || stage.runId !== engine.runId ||
      typeof stage.inputHash !== "string" || !/^[a-f0-9]{64}$/.test(stage.inputHash) ||
      !stage.patch || typeof stage.patch !== "object" || Array.isArray(stage.patch)) {
    return null;
  }
  return { runId: engine.runId, engineName: engine.engineName, inputHash: stage.inputHash, patch: stage.patch as Record<string, unknown> };
}

export function leadGenerationRecovery(status: string, payload: Record<string, unknown>, key = "engine") {
  if (key === "starterEngine" ? !starterGenerationActive(payload) : status !== "package_generating") return null;
  if (stagedLeadResult(payload, key)) {
    return { state: "result_staged", retryAllowed: false } as const;
  }

  const engine = payload[key] as {
    runId?: unknown;
    dispatchState?: unknown;
    providerReceipt?: { provider?: unknown; requestId?: unknown; generationId?: unknown };
  } | undefined;
  if (typeof engine?.runId === "string" && engine.runId && engine.dispatchState === "reserved") {
    return { state: "reserved", retryAllowed: true } as const;
  }
  const receipt = engine?.providerReceipt;
  if (typeof engine?.runId === "string" && engine.runId &&
      receipt?.provider === "vercel_gateway" && receipt.requestId === `lead_${engine.runId}` &&
      typeof receipt.generationId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(receipt.generationId)) {
    return { state: "provider_response_recorded", retryAllowed: false } as const;
  }
  if (typeof engine?.runId === "string" && engine.runId && engine.dispatchState === "started") {
    return { state: "dispatch_started", retryAllowed: false } as const;
  }
  return { state: "outcome_unconfirmed", retryAllowed: false } as const;
}
