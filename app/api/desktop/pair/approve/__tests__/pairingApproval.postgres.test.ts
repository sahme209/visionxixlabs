import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import type { PrismaClient } from "@/lib/prismaClient";
import { POST } from "../route";
import { POST as consume } from "../../status/route";

let fixture: PrismaClient;
vi.mock("@/lib/db", () => ({ get prisma() { return fixture; } }));
vi.mock("@/lib/auth/currentContext", () => ({
  currentContext: async () => ({ isAuthenticated: true, userId: "fixture-user", organizationId: "fixture-org" }),
}));
vi.mock("@/lib/desktop/desktopAuthPolicy", () => ({ evaluatePairingPolicy: async () => ({ allowed: true }) }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));

const enabled = process.env.AXIOM_RUN_OWNED_PAIR_FIXTURE === "1";
const suite = it.runIf(enabled);
beforeAll(async () => {
  if (!enabled) return;
  const target = process.env.AXIOM_OWNED_PAIR_PG_URL;
  const directory = process.env.AXIOM_OWNED_PAIR_PG_DATA;
  if (!target || !directory || !/^\/private\/tmp\/axiom-pair-pg\.[A-Za-z0-9]+\/data$/.test(directory)) {
    throw new Error("Owned pairing fixture required");
  }
  const url = new URL(target);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/v19_pair_fixture" || url.search || url.hash) {
    throw new Error("Owned loopback database required");
  }
  fixture = createDatabaseClient(target);
  expect(await fixture.$queryRaw`SELECT current_database() AS database, current_setting('data_directory') AS directory`)
    .toEqual([{ database: "v19_pair_fixture", directory }]);

  await fixture.$executeRaw`CREATE TABLE "DesktopPairingChallengeRecord" (
    id text PRIMARY KEY, "deviceFingerprint" text NOT NULL, "deviceLabel" text NOT NULL, platform text NOT NULL,
    "desktopVersion" text, status text NOT NULL DEFAULT 'pending', "approvedByUserId" text,
    "approvedOrganizationId" text, "sessionId" text, "createdAt" timestamp(3) NOT NULL DEFAULT now(),
    "expiresAt" timestamp(3) NOT NULL, "approvedAt" timestamp(3), "consumedAt" timestamp(3)
  )`;
  await fixture.$executeRaw`CREATE TABLE "DesktopSessionRecord" (
    id text PRIMARY KEY, "userId" text NOT NULL, "organizationId" text NOT NULL,
    "deviceFingerprint" text NOT NULL, "deviceLabel" text NOT NULL, platform text NOT NULL,
    "desktopVersion" text, "issuedAt" timestamp(3) NOT NULL, "expiresAt" timestamp(3) NOT NULL,
    "lastSeenAt" timestamp(3) NOT NULL, "revokedAt" timestamp(3), "revokeReason" text,
    "createdAt" timestamp(3) NOT NULL DEFAULT now()
  )`;
});

afterAll(async () => { await fixture?.$disconnect(); });
afterEach(() => vi.unstubAllEnvs());

function request(challenge: string) {
  return new NextRequest("https://example.test/api/desktop/pair/approve", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challenge }),
  });
}
async function insert(id: string) {
  await fixture.desktopPairingChallengeRecord.create({ data: {
    id, deviceFingerprint: id.repeat(4), deviceLabel: "Fixture workstation", platform: "macos-arm",
    expiresAt: new Date(Date.now() + 60_000),
  } });
}

suite("rolls back both approval and session when the final database write fails", async () => {
  const id = "rollback";
  await insert(id);
  await fixture.$executeRaw`CREATE FUNCTION refuse_fixture_pairing() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.id = 'rollback' AND NEW.status = 'approved' THEN
        RAISE EXCEPTION 'fixture rejects approval';
      END IF;
      RETURN NEW;
    END;
  $$`;
  await fixture.$executeRaw`CREATE TRIGGER refuse_fixture_pairing BEFORE UPDATE ON "DesktopPairingChallengeRecord"
    FOR EACH ROW EXECUTE FUNCTION refuse_fixture_pairing()`;

  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = (await POST(request(id)))!;
    expect(result.status).toBe(500);
    expect(await result.json()).toMatchObject({ error: "pairing_approval_failed" });
  } finally {
    log.mockRestore();
  }
  expect(await fixture.desktopPairingChallengeRecord.findUniqueOrThrow({ where: { id } }))
    .toMatchObject({ status: "pending", sessionId: null, approvedByUserId: null, approvedOrganizationId: null });
  expect(await fixture.desktopSessionRecord.count({ where: { deviceFingerprint: id.repeat(4) } })).toBe(0);
});

suite("creates one bound session for concurrent approvals", async () => {
  const id = "concurrent";
  await insert(id);
  const responses = await Promise.all(Array.from({ length: 6 }, () => POST(request(id))));
  expect(responses.some(response => response?.status === 200)).toBe(true);
  const approved = await fixture.desktopPairingChallengeRecord.findUniqueOrThrow({ where: { id } });
  expect(approved).toMatchObject({
    status: "approved", approvedByUserId: "fixture-user", approvedOrganizationId: "fixture-org",
  });
  expect(await fixture.desktopSessionRecord.findMany({ where: { deviceFingerprint: id.repeat(4) } }))
    .toMatchObject([{ id: approved.sessionId, userId: "fixture-user", organizationId: "fixture-org" }]);
});

suite("retains a signed-in approval through a signing failure and releases it once", async () => {
  const id = "consume";
  await insert(id);
  expect((await POST(request(id)))?.status).toBe(200);
  const poll = () => consume(new NextRequest("https://example.test/api/desktop/pair/status", {
    method: "POST", body: JSON.stringify({ challenge: id, deviceFingerprint: id.repeat(4) }),
    headers: { "content-type": "application/json" },
  }));
  vi.stubEnv("DESKTOP_SESSION_SIGNING_KEY", "");
  vi.stubEnv("NEXTAUTH_SECRET", "");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await poll()).status).toBe(503);
  } finally {
    log.mockRestore();
  }
  const approved = await fixture.desktopPairingChallengeRecord.findUniqueOrThrow({ where: { id } });
  expect(approved).toMatchObject({ status: "approved", consumedAt: null });
  vi.stubEnv("DESKTOP_SESSION_SIGNING_KEY", "synthetic-signing-key-for-local-tests-only");

  const results = await Promise.all(Array.from({ length: 6 }, poll));
  expect(results.filter(result => result.status === 200)).toHaveLength(1);
  expect(results.filter(result => result.status === 409)).toHaveLength(5);
  const successful = results.find(result => result.status === 200)!;
  expect(successful.headers.get("cache-control")).toBe("no-store");
  expect(await successful.json()).toMatchObject({ status: "approved", session: { id: approved.sessionId } });
  expect(await fixture.desktopPairingChallengeRecord.findUniqueOrThrow({ where: { id } }))
    .toMatchObject({ status: "consumed", consumedAt: expect.any(Date) });
});
