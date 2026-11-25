/** Issued by the lead runner for a single, already-fenced generation attempt. */
export type LeadGenerationInvocation = {
  requestId: string;
  recordGatewayGeneration: (generationId: string | undefined) => Promise<void>;
};
