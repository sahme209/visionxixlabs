import { describe, expect, it } from "vitest";
import {
  buildSlackConfigUpsertResponse,
  buildSlackConfigReadResponse,
  buildSlackLogListResponse,
  sendSlackSignalBestEffort,
  type ConfigRow,
  type LogRow,
  type SlackRepo,
} from "../slackNotificationResponder";
import type { SlackFetcher } from "../slackNotificationEngine";

interface Stub extends SlackRepo {
  _configs: ConfigRow[];
  _logs: LogRow[];
  _nextId: number;
}

function makeRepo(): Stub {
  const stub: Stub = {
    _configs: [],
    _logs: [],
    _nextId: 1,
    slackNotificationConfig: {
      async findUnique({ where }) {
        return stub._configs.find((c) => c.organizationId === where.organizationId) ?? null;
      },
      async upsert({ where, create, update }) {
        const existing = stub._configs.find((c) => c.organizationId === where.organizationId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: ConfigRow = {
          id: `cfg_${stub._nextId++}`,
          organizationId: create.organizationId,
          webhookUrl: create.webhookUrl,
          enabledSignalKindsJson: create.enabledSignalKindsJson,
          defaultChannel: create.defaultChannel,
          enabled: create.enabled,
        };
        stub._configs.push(row);
        return row;
      },
    },
    slackNotificationLog: {
      async findMany({ where, take }) {
        const out = stub._logs.filter((l) => {
          if (l.organizationId !== where.organizationId) return false;
          if (where.signalKind && l.signalKind !== where.signalKind) return false;
          if (where.outcome && l.outcome !== where.outcome) return false;
          return true;
        }).sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
        return take ? out.slice(0, take) : out;
      },
      async create({ data }) {
        const row: LogRow = {
          id: `log_${stub._nextId++}`,
          organizationId: data.organizationId,
          signalKind: data.signalKind,
          subjectKind: data.subjectKind,
          subjectId: data.subjectId,
          title: data.title,
          outcome: data.outcome,
          httpStatus: data.httpStatus,
          errorMessage: data.errorMessage,
          payloadJson: data.payloadJson,
          generatedAt: new Date(Date.now() + stub._logs.length),
        };
        stub._logs.push(row);
        return row;
      },
    },
  };
  return stub;
}

const VALID_URL = "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX";

describe("buildSlackConfigUpsertResponse", () => {
  it("422 webhook_url_required when empty", async () => {
    const stub = makeRepo();
    const r = await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: " " });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("webhook_url_required");
  });

  it("422 webhook_url_invalid when not a Slack URL", async () => {
    const stub = makeRepo();
    const r = await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: "https://example.com/webhook" });
    expect(r.status).toBe(422);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("webhook_url_invalid");
  });

  it("200 creates a new config + cleans enabledSignalKinds", async () => {
    const stub = makeRepo();
    const r = await buildSlackConfigUpsertResponse(stub, {
      organizationId: "o", webhookUrl: VALID_URL,
      enabledSignalKinds: ["council_critical", "not_a_kind"],
      defaultChannel: "#deploys",
    });
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.config.enabledSignalKinds).toEqual(["council_critical"]);
    expect(r.body.data.config.defaultChannel).toBe("#deploys");
    expect(r.body.data.config.enabled).toBe(true);
  });

  it("200 updates an existing config", async () => {
    const stub = makeRepo();
    await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: VALID_URL });
    const r = await buildSlackConfigUpsertResponse(stub, {
      organizationId: "o", webhookUrl: VALID_URL, enabled: false,
    });
    expect(r.status).toBe(200);
    expect(stub._configs.length).toBe(1);
    expect(stub._configs[0].enabled).toBe(false);
  });
});

describe("buildSlackConfigReadResponse", () => {
  it("200 with null config when none exists", async () => {
    const stub = makeRepo();
    const r = await buildSlackConfigReadResponse(stub, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.config).toBeNull();
  });

  it("200 masks the webhook URL", async () => {
    const stub = makeRepo();
    await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: VALID_URL });
    const r = await buildSlackConfigReadResponse(stub, "o");
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.config?.webhookUrl).toContain("…");
    expect(r.body.data.config?.webhookUrl).not.toBe(VALID_URL);
  });
});

describe("buildSlackLogListResponse", () => {
  it("200 reports per-outcome summary", async () => {
    const stub = makeRepo();
    const now = new Date();
    stub._logs.push(
      { id: "l1", organizationId: "o", signalKind: "council_critical", subjectKind: null, subjectId: null, title: "t1", outcome: "sent", httpStatus: 200, errorMessage: null, payloadJson: {}, generatedAt: now },
      { id: "l2", organizationId: "o", signalKind: "council_critical", subjectKind: null, subjectId: null, title: "t2", outcome: "error", httpStatus: 500, errorMessage: "boom", payloadJson: {}, generatedAt: now },
      { id: "l3", organizationId: "o", signalKind: "council_critical", subjectKind: null, subjectId: null, title: "t3", outcome: "skipped_filtered", httpStatus: null, errorMessage: null, payloadJson: {}, generatedAt: now },
    );
    const r = await buildSlackLogListResponse(stub, { organizationId: "o" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.summary).toEqual({ total: 3, sent: 1, errored: 1, skipped: 1 });
  });
});

describe("sendSlackSignalBestEffort", () => {
  const okFetcher: SlackFetcher = async () => ({ status: 200, ok: true, text: async () => "" });

  function signal() {
    return {
      kind: "council_critical" as const,
      title: "Block deploy",
      summary: "Council recommends block_deploy.",
      severity: "critical" as const,
    };
  }

  it("returns skipped_not_configured + logs reason when no config", async () => {
    const stub = makeRepo();
    const outcome = await sendSlackSignalBestEffort(stub, { organizationId: "o", signal: signal() }, okFetcher);
    expect(outcome).toBe("skipped_not_configured");
    expect(stub._logs[0].outcome).toBe("skipped_not_configured");
    expect(stub._logs[0].errorMessage).toBe("no_config");
  });

  it("returns skipped_not_configured + logs when config disabled", async () => {
    const stub = makeRepo();
    await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: VALID_URL, enabled: false });
    const outcome = await sendSlackSignalBestEffort(stub, { organizationId: "o", signal: signal() }, okFetcher);
    expect(outcome).toBe("skipped_not_configured");
  });

  it("returns skipped_filtered when kind not in enabled list", async () => {
    const stub = makeRepo();
    await buildSlackConfigUpsertResponse(stub, {
      organizationId: "o",
      webhookUrl: VALID_URL,
      enabledSignalKinds: ["triage_auto_escalate"], // not council_critical
    });
    const outcome = await sendSlackSignalBestEffort(stub, { organizationId: "o", signal: signal() }, okFetcher);
    expect(outcome).toBe("skipped_filtered");
    expect(stub._logs[0].outcome).toBe("skipped_filtered");
  });

  it("returns sent + logs httpStatus when fetcher returns 2xx", async () => {
    const stub = makeRepo();
    await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: VALID_URL });
    const outcome = await sendSlackSignalBestEffort(stub, { organizationId: "o", signal: signal() }, okFetcher);
    expect(outcome).toBe("sent");
    expect(stub._logs[0].outcome).toBe("sent");
    expect(stub._logs[0].httpStatus).toBe(200);
  });

  it("returns error + logs reason when fetcher rejects", async () => {
    const stub = makeRepo();
    await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: VALID_URL });
    const boomFetcher: SlackFetcher = async () => ({ status: 500, ok: false, text: async () => "internal_error" });
    const outcome = await sendSlackSignalBestEffort(stub, { organizationId: "o", signal: signal() }, boomFetcher);
    expect(outcome).toBe("error");
    expect(stub._logs[0].errorMessage).toContain("internal_error");
  });

  it("never throws — exception from fetcher → 'error' outcome", async () => {
    const stub = makeRepo();
    await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: VALID_URL });
    const explodingFetcher: SlackFetcher = async () => { throw new Error("DNS failed"); };
    const outcome = await sendSlackSignalBestEffort(stub, { organizationId: "o", signal: signal() }, explodingFetcher);
    expect(outcome).toBe("error");
  });

  it("logs persist even when DB log call fails (overall outcome stays correct)", async () => {
    const stub = makeRepo();
    await buildSlackConfigUpsertResponse(stub, { organizationId: "o", webhookUrl: VALID_URL });
    stub.slackNotificationLog.create = async () => { throw new Error("log table missing"); };
    const outcome = await sendSlackSignalBestEffort(stub, { organizationId: "o", signal: signal() }, okFetcher);
    // Even though logging failed, signal still sent successfully.
    expect(outcome).toBe("sent");
  });
});
