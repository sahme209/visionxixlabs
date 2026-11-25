import { leadFormSchema } from "@/lib/leads/leadSchema";
import { sha256ContentHash } from "@/lib/tauri/contentHash";

export function adminGenerationRevision(lead: { id: string; source: string; status: string; updatedAt: Date; fullPayload: unknown }) {
  const payload = lead.fullPayload as { form?: unknown; engine?: { runId?: unknown }; starterEngine?: { runId?: unknown } } | null;
  const detailedForm = leadFormSchema.safeParse(lead.fullPayload);
  return sha256ContentHash({
    id: lead.id,
    source: lead.source,
    status: lead.status,
    updatedAt: lead.updatedAt.toISOString(),
    form: payload?.form,
    detailedForm: detailedForm.success ? detailedForm.data : undefined,
    runId: payload?.engine?.runId,
    starterRunId: payload?.starterEngine?.runId,
  });
}

export function parseAdminGenerationHeaders(headers: Headers) {
  const requestId = headers.get("idempotency-key");
  const revision = headers.get("x-v19-lead-revision");
  if (!requestId || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(requestId) ||
      !revision || !/^[a-f0-9]{64}$/.test(revision)) return null;
  return { requestId, revision };
}
