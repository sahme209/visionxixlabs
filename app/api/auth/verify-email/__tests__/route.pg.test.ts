import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@/lib/prismaClient";
import { NextRequest } from "next/server";
const fixture = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient }));
vi.mock("@/lib/db", () => ({ get prisma() { return fixture.client; } }));
import { GET } from "../route";
import { hashEmailVerificationToken } from "@/lib/auth/emailVerification";

const socket = process.env.AXIOM_OWNED_WORKFLOW_PG_SOCKET;
describe.skipIf(!socket)("email proof actual isolated PostgreSQL", () => {
  let userId: string; let token: string;
  beforeAll(async () => {
    if (!socket || !/^\/private\/tmp\/axiom-private-restore-[^/]+\/socket$/.test(socket)
        || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0) throw new Error("owned_private_socket_required");
    fixture.client = createDatabaseClient(`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`);
    const [binding] = await fixture.client.$queryRawUnsafe<Array<{ private: boolean }>>(
      `SELECT current_database()='neondb' AND current_user='recovery_fixture'
        AND current_setting('listen_addresses')='' AS private`);
    if (!binding?.private) throw new Error("owned_fixture_binding_required");
  });
  beforeEach(async () => {
    userId = `owned_proof_${randomUUID()}`; token = randomUUID();
    await fixture.client.user.create({ data: { id: userId, email: `${userId}@example.invalid` } });
    await fixture.client.emailVerificationToken.create({ data: { userId, tokenHash: hashEmailVerificationToken(token), expiresAt: new Date(Date.now() + 60_000) } });
  });
  afterEach(async () => { if (userId) await fixture.client.user.delete({ where: { id: userId } }); });
  afterAll(async () => { await fixture.client?.$disconnect(); });
  const request = (proof: string, callback?: string) => {
    const url = new URL("https://fixture.example.invalid/api/auth/verify-email");
    url.searchParams.set("token", proof); if (callback) url.searchParams.set("callbackUrl", callback);
    return new NextRequest(url);
  };
  it("commits one concurrent proof and denies replay without granting a session", async () => {
    const responses = await Promise.all([GET(request(token)), GET(request(token))]);
    expect(responses.map(r => r.status).sort()).toEqual([307, 400]);
    expect(responses.every(r => r.headers.get("set-cookie") === null)).toBe(true);
    const user = await fixture.client.user.findUniqueOrThrow({ where: { id: userId } });
    const proof = await fixture.client.emailVerificationToken.findUniqueOrThrow({ where: { tokenHash: hashEmailVerificationToken(token) } });
    expect(user.emailVerifiedAt).not.toBeNull(); expect(proof.usedAt).toEqual(user.emailVerifiedAt);
    expect((await GET(request(token))).status).toBe(400);
  });
  it("rolls back the proof claim on identity-write failure and permits the same link afterward", async () => {
    // Owned fixture hook only: fail this synthetic identity update, never any customer row.
    await fixture.client.$executeRawUnsafe(`CREATE FUNCTION public.owned_proof_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id LIKE 'owned_proof_%' THEN RAISE EXCEPTION 'fixture_failure'; END IF; RETURN NEW; END $$`);
    await fixture.client.$executeRawUnsafe(`CREATE TRIGGER owned_proof_failure BEFORE UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.owned_proof_failure()`);
    try {
      const response = await GET(request(token)); expect(response.status).toBe(503);
      expect(await response.text()).not.toContain(token);
      expect((await fixture.client.emailVerificationToken.findUniqueOrThrow({ where: { tokenHash: hashEmailVerificationToken(token) } })).usedAt).toBeNull();
      expect((await fixture.client.user.findUniqueOrThrow({ where: { id: userId } })).emailVerifiedAt).toBeNull();
    } finally {
      await fixture.client.$executeRawUnsafe(`DROP TRIGGER owned_proof_failure ON public."User"`);
      await fixture.client.$executeRawUnsafe(`DROP FUNCTION public.owned_proof_failure()`);
    }
    expect((await GET(request(token))).status).toBe(307);
  });
  it("refuses expired proof and preserves its unverified account", async () => {
    await fixture.client.emailVerificationToken.update({ where: { tokenHash: hashEmailVerificationToken(token) }, data: { expiresAt: new Date(0) } });
    expect((await GET(request(token))).status).toBe(400);
    expect((await fixture.client.user.findUniqueOrThrow({ where: { id: userId } })).emailVerifiedAt).toBeNull();
  });
  it("preserves pairing navigation and drops an external callback", async () => {
    const callback = "/desktop/connect?challenge=pair_fixture&intent=sign_up";
    const response = await GET(request(token, callback));
    expect(response.status).toBe(307);
    const destination = new URL(response.headers.get("location")!);
    expect(destination.searchParams.get("callbackUrl")).toBe(callback);
    expect(response.headers.get("set-cookie")).toBeNull();
    // A separate proof for the same synthetic account exercises only navigation.
    const another = randomUUID();
    await fixture.client.emailVerificationToken.create({ data: { userId, tokenHash: hashEmailVerificationToken(another), expiresAt: new Date(Date.now() + 60_000) } });
    expect(new URL((await GET(request(another, "https://external.invalid"))).headers.get("location")!).searchParams.has("callbackUrl")).toBe(false);
  });
});
