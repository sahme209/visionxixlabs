import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { GenerationNotDispatchedError } from "@/lib/ai/generationNotDispatched";
import { generate as generateAI } from "@/lib/ai/orchestrator";
import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import type { PrismaClient } from "@/lib/prismaClient";
import { runDetailedStarter } from "@/lib/leads/runDetailedStarter";
import { adminGenerationRevision } from "../adminGenerationIntent";
import { leadGenerationRecovery } from "../generationRecovery";
import { LeadEngineBusyError, LeadGenerationRevisionChangedError, runAsyncLeadEngine } from "../engineRunner";

let fixture: PrismaClient;
const sdk = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateText: sdk }));
vi.mock("@/lib/db", () => ({ get prisma() { return fixture; } }));

const enabled = process.env.AXIOM_RUN_OWNED_LEAD_FIXTURE === "1";
const suite = it.runIf(enabled);

beforeAll(async () => {
  if (!enabled) return;
  const target = process.env.AXIOM_OWNED_LEAD_PG_URL;
  const directory = process.env.AXIOM_OWNED_LEAD_PG_DATA;
  if (!target || !directory || !/^\/private\/tmp\/axiom-lead-pg\.[A-Za-z0-9]+\/data$/.test(directory)) {
    throw new Error("Owned lead fixture required");
  }
  const url = new URL(target);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/v19_lead_fixture" || url.search || url.hash) {
    throw new Error("Owned loopback database required");
  }

  fixture = createDatabaseClient(target);
  const identity = await fixture.$queryRaw<Array<{ database: string; directory: string }>>`
    SELECT current_database() AS database, current_setting('data_directory') AS directory
  `;
  expect(identity).toEqual([{ database: "v19_lead_fixture", directory }]);
  await fixture.$executeRaw`CREATE TABLE "Lead" (
    id text PRIMARY KEY, email text NOT NULL, name text, "userId" text,
    source text NOT NULL, status text NOT NULL, "fullPayload" jsonb NOT NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT now(), "updatedAt" timestamp(3) NOT NULL
  )`;
  await fixture.$executeRaw`CREATE TABLE "AIInvocation" (
    id text PRIMARY KEY, "userId" text, "taskType" text NOT NULL, provider text NOT NULL,
    model text NOT NULL, "latencyMs" integer, success boolean NOT NULL, "errorMessage" text,
    "tokensIn" integer, "tokensOut" integer, "promptHash" text, "promptPreview" varchar(200),
    "requestId" text, "createdAt" timestamp(3) NOT NULL DEFAULT now()
  )`;
});

afterAll(async () => { await fixture?.$disconnect(); });

afterEach(() => vi.unstubAllEnvs());

type RunOptions = Parameters<typeof runAsyncLeadEngine<string>>[0];
function run(leadId: string, generate: RunOptions["generate"], adminIntent?: RunOptions["adminIntent"]) {
  return runAsyncLeadEngine({
    leadId, engineName: "cloud-studio", expectedSource: "cloud-studio", adminIntent,
    getTier: () => "free", generate, persist: ({ result }) => ({ output: result }),
    isReady: (payload) => typeof payload.output === "string",
    getExistingResult: (payload) => typeof payload.output === "string" ? payload.output : null,
  });
}

suite("recovers an abandoned reservation with exactly one provider admission under racing requests", async () => {
  const leadId = "reserved";
  await fixture.lead.create({ data: {
    id: leadId, email: "sample@example.test", source: "cloud-studio", status: "package_generating",
    fullPayload: { engine: { runId: "abandoned-reservation", dispatchState: "reserved" }, note: "preserved" },
  } });
  const generate = vi.fn(async () => "report");
  await Promise.allSettled(Array.from({ length: 8 }, () => run(leadId, generate)));
  expect(generate).toHaveBeenCalledOnce();
  await expect(run(leadId, generate)).resolves.toMatchObject({ generated: "report", reused: true });
  const lead = await fixture.lead.findUniqueOrThrow({ where: { id: leadId } });
  expect(lead.fullPayload).toMatchObject({ output: "report", note: "preserved", engine: { dispatchState: "completed" } });
});

suite("holds ambiguous dispatch, and permits retry only for proven preflight refusal", async () => {
  const leadId = "failure";
  await fixture.lead.create({ data: {
    id: leadId, email: "sample@example.test", source: "cloud-studio", status: "created", fullPayload: {},
  } });
  const generate = vi.fn()
    .mockRejectedValueOnce(new GenerationNotDispatchedError("preflight"))
    .mockRejectedValueOnce(new Error("ambiguous timeout"));
  await expect(run(leadId, generate)).rejects.toThrow("preflight");
  await expect(run(leadId, generate)).rejects.toThrow("ambiguous timeout");
  await expect(run(leadId, generate)).rejects.toBeInstanceOf(LeadEngineBusyError);
  expect(generate).toHaveBeenCalledTimes(2);
  const lead = await fixture.lead.findUniqueOrThrow({ where: { id: leadId } });
  expect(lead).toMatchObject({ status: "package_generating", fullPayload: { engine: { dispatchState: "outcome_unconfirmed" } } });
});

suite("correlates an interrupted report with the actual Gateway adapter and invocation row", async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-fixture-key");
  vi.stubEnv("AI_GATEWAY_MODEL", "synthetic/lead-fixture");
  sdk.mockResolvedValue({
    text: "synthetic provider response",
    finishReason: "stop",
    usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7 },
    providerMetadata: { gateway: { generationId: "gen_lead_fixture" } },
  });
  const leadId = "gateway-correlation";
  await fixture.lead.create({ data: {
    id: leadId, email: "sample@example.test", source: "cloud-studio", status: "created", fullPayload: {},
  } });
  const generate = vi.fn(async ({ invocation }) => {
    await generateAI({ taskType: "cloud_automation", userPrompt: "sample private report", leadInvocation: invocation });
    throw new Error("report parsing failed after Gateway response");
  });

  await expect(run(leadId, generate)).rejects.toThrow("report parsing failed");
  const { status, fullPayload } = await fixture.lead.findUniqueOrThrow({ where: { id: leadId } });
  const { engine } = fullPayload as { engine: { runId: string } };
  const requestId = `lead_${engine.runId}`;
  expect(engine).toMatchObject({
    dispatchState: "outcome_unconfirmed",
    providerReceipt: { provider: "vercel_gateway", requestId, generationId: "gen_lead_fixture" },
  });
  expect(leadGenerationRecovery(status, fullPayload as Record<string, unknown>)).toEqual({ state: "provider_response_recorded", retryAllowed: false });
  expect(sdk).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    maxRetries: 0,
    providerOptions: { gateway: { tags: ["product:axiom-agent", `correlation:${requestId}`] } },
  }));
  expect(await fixture.aIInvocation.findMany({ where: { requestId } })).toMatchObject([{
    provider: "vercel_gateway", requestId, success: true, tokensIn: 4, tokensOut: 3,
    promptHash: null, promptPreview: null, userId: null,
  }]);
  await expect(run(leadId, generate)).rejects.toBeInstanceOf(LeadEngineBusyError);
  expect(generate).toHaveBeenCalledOnce();
});

suite("recovers an exact staged result after PostgreSQL rejects its final publication", async () => {
  const leadId = "staged-result";
  await fixture.$executeRaw`CREATE FUNCTION refuse_fixture_publication() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.id = 'staged-result' AND OLD."fullPayload"->>'simulateWriteRefusal' = 'true'
        AND NEW.status = 'package_ready' THEN
        RAISE EXCEPTION 'fixture rejects publication';
      END IF;
      RETURN NEW;
    END;
  $$`;
  await fixture.$executeRaw`CREATE TRIGGER refuse_fixture_publication BEFORE UPDATE ON "Lead"
    FOR EACH ROW EXECUTE FUNCTION refuse_fixture_publication()`;
  await fixture.lead.create({ data: {
    id: leadId, email: "sample@example.test", source: "cloud-studio", status: "created",
    fullPayload: { form: { cloudProvider: "fixture" }, simulateWriteRefusal: true },
  } });
  const generate = vi.fn(async () => "report recovered from durable result");

  await expect(run(leadId, generate)).rejects.toThrow("fixture rejects publication");
  const staged = await fixture.lead.findUniqueOrThrow({ where: { id: leadId } });
  expect(staged.status).toBe("package_generating");
  expect(staged.fullPayload).not.toHaveProperty("output");
  expect(staged.fullPayload).toMatchObject({ engine: { dispatchState: "result_staged" } });

  await fixture.$executeRaw`UPDATE "Lead" SET "fullPayload" =
    "fullPayload" || '{"simulateWriteRefusal": false, "note": "new unrelated metadata"}'::jsonb
    WHERE id = ${leadId}`;
  const results = await Promise.all([run(leadId, generate), run(leadId, generate)]);
  expect(results.every(result => result.generated === "report recovered from durable result" && result.reused)).toBe(true);
  expect(generate).toHaveBeenCalledOnce();
  const saved = await fixture.lead.findUniqueOrThrow({ where: { id: leadId } });
  expect(saved).toMatchObject({ status: "package_ready", fullPayload: {
    note: "new unrelated metadata", output: "report recovered from durable result",
    engine: { dispatchState: "completed", stagedResult: null },
  } });
});

suite("replays a committed admin request and rejects it after an explicit later generation", async () => {
  const leadId = "admin-regeneration";
  const lead = await fixture.lead.create({ data: {
    id: leadId, email: "sample@example.test", source: "cloud-studio", status: "created",
    fullPayload: { form: { cloudProvider: "fixture" } },
  } });
  const firstIntent = {
    actorId: "operator-fixture", requestId: "229e0391-85ce-4f5e-b342-5216a22e0001",
    revision: adminGenerationRevision(lead),
  };
  const generate = vi.fn(async () => "saved report");

  await expect(run(leadId, generate, firstIntent)).resolves.toMatchObject({ reused: false });
  await expect(run(leadId, generate, firstIntent)).resolves.toMatchObject({ reused: true });
  await expect(run(leadId, generate, { ...firstIntent, actorId: "another-fixture" })).rejects.toBeInstanceOf(LeadGenerationRevisionChangedError);
  expect(generate).toHaveBeenCalledOnce();

  const current = await fixture.lead.findUniqueOrThrow({ where: { id: leadId } });
  const secondIntent = {
    ...firstIntent, requestId: "229e0391-85ce-4f5e-b342-5216a22e0002",
    revision: adminGenerationRevision(current),
  };
  await expect(run(leadId, generate, secondIntent)).resolves.toMatchObject({ reused: false });
  await expect(run(leadId, generate, firstIntent)).rejects.toBeInstanceOf(LeadGenerationRevisionChangedError);
  expect(generate).toHaveBeenCalledTimes(2);
});

suite("fences concurrent detailed starter dispatch without disturbing the existing website", async () => {
  vi.stubEnv("AI_GATEWAY_API_KEY", "synthetic-fixture-key");
  vi.stubEnv("AI_GATEWAY_MODEL", "synthetic/lead-fixture");
  sdk.mockClear();
  sdk.mockResolvedValue({
    text: JSON.stringify({ heroHeadline: "Legacy website brief", siteStructure: { pages: [{ name: "Home", sections: ["Intro"] }] } }),
    finishReason: "stop",
    usage: { inputTokens: 4, outputTokens: 7, totalTokens: 11 },
    providerMetadata: { gateway: { generationId: "gen_legacy_starter_fixture" } },
  });
  const leadId = "legacy-starter";
  await fixture.lead.create({ data: {
    id: leadId, email: "sample@example.test", source: "website-request", status: "published",
    fullPayload: {
      fullName: "Owned Fixture", email: "sample@example.test", industry: "technology",
      projectType: "new_website", numberOfPages: 1, projectGoals: ["informational"],
      outputStatus: "ready", engine: { outputStatus: "ready", runId: "prior-preview" },
    },
  } });
  await Promise.allSettled(Array.from({ length: 6 }, () => runDetailedStarter(leadId)));
  expect(sdk).toHaveBeenCalledOnce();
  await expect(runDetailedStarter(leadId)).resolves.toMatchObject({ reused: true, generated: { heroHeadline: "Legacy website brief" } });
  const saved = await fixture.lead.findUniqueOrThrow({ where: { id: leadId } });
  expect(saved).toMatchObject({ status: "published", fullPayload: {
    outputStatus: "ready", engine: { outputStatus: "ready", runId: "prior-preview" },
    starterEngine: { dispatchState: "completed", providerReceipt: { generationId: "gen_legacy_starter_fixture" } },
  } });
});
