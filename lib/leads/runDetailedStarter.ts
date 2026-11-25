import { runAsyncLeadEngine } from "@/lib/async/engineRunner";
import { generateWebsiteStarter, type AiStarterPackage } from "@/lib/websiteStarter/engine";
import { leadFormSchema } from "./leadSchema";

export function savedStarterPackage(payload: Record<string, unknown>) {
  const value = payload.aiStarterPackage;
  return value && typeof value === "object" && !Array.isArray(value) ? value as AiStarterPackage : null;
}

export function runDetailedStarter(
  leadId: string,
  adminIntent?: { actorId: string; requestId: string; revision: string },
) {
  return runAsyncLeadEngine<AiStarterPackage>({
    leadId, engineName: "website-starter", expectedSource: "website-request",
    getTier: () => "free", adminIntent,
    isReady: payload => Boolean(savedStarterPackage(payload)),
    getExistingResult: savedStarterPackage,
    generate: async ({ payload, invocation }) =>
      await generateWebsiteStarter({ variant: "detailed", form: leadFormSchema.parse(payload) }, "free", invocation) as AiStarterPackage,
    persist: ({ result }) => ({ aiStarterPackage: result, aiStarterError: false }),
    replacePayloadKeys: ["aiStarterPackage"],
  });
}
