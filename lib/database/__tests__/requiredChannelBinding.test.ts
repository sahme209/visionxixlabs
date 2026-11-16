import { afterEach, expect, it, vi } from "vitest";
import { Client, type ClientConfig } from "pg";
import pgPackage from "pg/package.json" with { type: "json" };
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { TLSSocket, rootCertificates } from "node:tls";
import { createHash, createHmac, pbkdf2Sync, X509Certificate } from "node:crypto";
import saslModule from "pg/lib/crypto/sasl.js";
import certificatesModule from "pg/lib/crypto/cert-signatures.js";
import { requiredChannelBindingClient } from "../requiredChannelBinding";
import { postgresConnectionOptions } from "../postgresConnectionPolicy";
import { directNeonSessionOptions } from "../directNeonSession";

// Synthetic TLS objects test races only. The independently owned wire fixture
// must negotiate ACTUAL local TLS before merge; no browser/DB/provider proof here.
const certificateHelpers = certificatesModule as { signatureAlgorithmHashFromCertificate(raw: Buffer): string };
const raw = rootCertificates.map(pem => new X509Certificate(pem).raw).find(cert => {
  try { return certificateHelpers.signatureAlgorithmHashFromCertificate(cert) === "SHA-256"; } catch { return false; }
})!;
if (!raw) throw new Error("synthetic_public_certificate_fixture_unavailable");
const unavailable = "postgres_channel_binding_required_unavailable";
const clients: Client[] = [];
function tlsStream(certificate = raw) {
  const stream = new TLSSocket(new PassThrough());
  Reflect.set(stream, "authorized", true);
  Reflect.set(stream, "secureConnecting", false);
  Reflect.set(stream, "getPeerCertificate", () => ({ raw: certificate }));
  return stream;
}
class Connection extends EventEmitter {
  stream = tlsStream();
  sent: Array<{ kind: string; mechanism?: string; data: string }> = [];
  _connecting = false;
  constructor() { super(); this.stream.on("close", () => this.emit("end")); this.stream.on("error", error => this.emit("error", error)); }
  connect() { this._connecting = true; queueMicrotask(() => this.emit("connect")); }
  requestSsl() { queueMicrotask(() => this.emit("sslconnect")); }
  startup() { /* configuration only; no network */ }
  sendSASLInitialResponseMessage(mechanism: string, data: string) { this.sent.push({ kind: "initial", mechanism, data }); }
  sendSCRAMClientFinalMessage(data: string) { this.sent.push({ kind: "final", data }); }
  password(data: string) { this.sent.push({ kind: "password", data }); }
  end() { this.stream.destroy(); }
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function until(check: () => boolean) {
  const end = Date.now() + 1000;
  while (!check()) { if (Date.now() >= end) throw new Error("synthetic_phase_timeout"); await new Promise(resolve => setTimeout(resolve, 1)); }
}
function fixture(password: () => string | Promise<string> = () => "synthetic-password-only") {
  const connection = new Connection(), getter = vi.fn(password), complete = vi.fn();
  const options = postgresConnectionOptions("postgresql://fixture@localhost/owned?sslmode=require&channel_binding=require");
  const Constructor = requiredChannelBindingClient(Client);
  const config: ClientConfig & { connection: Connection } = { ...options, password: getter, connection };
  const client = new Constructor(config); clients.push(client);
  client.connect(complete);
  return { client, connection, getter, complete };
}
afterEach(async () => { for (const client of clients.splice(0)) client.end(() => undefined); await tick(); vi.restoreAllMocks(); });
async function initial(f: ReturnType<typeof fixture>) {
  await tick();
  f.connection.emit("authenticationSASL", { mechanisms: ["SCRAM-SHA-256", "SCRAM-SHA-256-PLUS"] });
  await until(() => f.connection.sent.length > 0);
  const sent = f.connection.sent[0]; expect(sent.mechanism).toBe("SCRAM-SHA-256-PLUS");
  const nonce = /,r=(.+)$/.exec(sent.data)![1];
  const first = `r=${nonce}synthetic-server,s=c3ludGhldGljLXNhbHQ=,i=4096`;
  return { first, bare: sent.data.split(",,")[1] };
}
async function final(f: ReturnType<typeof fixture>) {
  const { first, bare } = await initial(f);
  f.connection.emit("authenticationSASLContinue", { data: first });
  await until(() => f.connection.sent.some(sent => sent.kind === "final"));
  const data = f.connection.sent.find(sent => sent.kind === "final")!.data;
  const without = data.slice(0, data.lastIndexOf(",p=")), auth = `${bare},${first},${without}`;
  const salted = pbkdf2Sync("synthetic-password-only", Buffer.from("synthetic-salt"), 4096, 32, "sha256");
  const hmac = (key: Buffer, text: string) => createHmac("sha256", key).update(text).digest();
  const clientKey = hmac(salted, "Client Key"), signature = hmac(createHash("sha256").update(clientKey).digest(), auth);
  expect(data.split(",p=")[1]).toBe(Buffer.from(clientKey.map((value, index) => value ^ signature[index])).toString("base64"));
  const binding = Buffer.from(/^c=([^,]+)/.exec(data)![1], "base64");
  expect(binding).toEqual(Buffer.concat([Buffer.from("p=tls-server-end-point,,"), createHash("sha256").update(raw).digest()]));
  return `v=${hmac(hmac(salted, "Server Key"), auth).toString("base64")}`;
}
it("accepts exact require only with TLS and leaves every non-require property shape unchanged", () => {
  const base = "postgresql://fixture@localhost/owned?sslmode=require";
  const prior = postgresConnectionOptions(base), required = postgresConnectionOptions(`${base}&channel_binding=require`);
  const { password: _password1, ...a } = prior, { password: _password2, requireChannelBinding, ...b } = required;
  expect(requireChannelBinding).toBe(true); expect(b).toEqual(a); expect(prior).not.toHaveProperty("requireChannelBinding");
  expect(() => postgresConnectionOptions("postgresql://fixture@localhost/owned?channel_binding=require")).toThrow("postgres_connection_configuration_unavailable");
  expect(() => postgresConnectionOptions(`${base}&channel_binding=synthetic_unsupported`)).toThrow("postgres_connection_configuration_unavailable");
  expect(directNeonSessionOptions(required).Client).toBeDefined();
});
it.each(["authenticationCleartextPassword", "authenticationMD5Password", "authenticationOk", "readyForQuery"])("refuses %s before password retrieval or any authentication write", async event => {
  const f = fixture(); await tick(); f.connection.emit(event, { status: "I", salt: Buffer.alloc(4) }); await tick();
  expect(f.getter).not.toHaveBeenCalled(); expect(f.connection.sent).toEqual([]); expect(f.complete).toHaveBeenCalledTimes(1);
  expect(f.complete.mock.calls[0][0]?.message).toBe(unavailable); expect(f.connection.stream.destroyed).toBe(true);
});
it.each([["SCRAM-SHA-256"], ["synthetic_unknown"], []].map(mechanisms => ({ mechanisms })))("refuses an offered mechanism set without PLUS before password retrieval ($mechanisms)", async ({ mechanisms }) => {
  const f = fixture(); await tick(); f.connection.emit("authenticationSASL", { mechanisms }); await tick();
  expect(f.getter).not.toHaveBeenCalled(); expect(f.connection.sent).toEqual([]); expect(f.complete.mock.calls[0][0]?.message).toBe(unavailable);
});
it.each(["unauthorized", "still_connecting", "malformed_certificate", "empty_certificate", "authorization_error"])("refuses invalid synthetic TLS %s before password retrieval", async kind => {
  const f = fixture(); await tick();
  if (kind === "unauthorized") Reflect.set(f.connection.stream, "authorized", false);
  if (kind === "still_connecting") Reflect.set(f.connection.stream, "secureConnecting", true);
  if (kind === "authorization_error") Reflect.set(f.connection.stream, "authorizationError", new Error("synthetic_private_input"));
  if (kind === "malformed_certificate" || kind === "empty_certificate") Reflect.set(f.connection.stream, "getPeerCertificate", () => ({ raw: kind === "empty_certificate" ? Buffer.alloc(0) : Buffer.from("synthetic_private_input") }));
  f.connection.emit("authenticationSASL", { mechanisms: ["SCRAM-SHA-256-PLUS"] }); await tick();
  expect(f.getter).not.toHaveBeenCalled(); expect(f.connection.sent).toEqual([]);
  expect(f.complete.mock.calls[0][0]?.message).toBe(unavailable); expect(f.complete.mock.calls[0][0]?.cause).toBeUndefined();
});
it("requires independently verified PLUS proof, AuthenticationOk, then Ready before connection; later Ready remains usable", async () => {
  const f = fixture(), proof = await final(f);
  expect(f.complete).not.toHaveBeenCalled(); f.connection.emit("authenticationSASLFinal", { data: proof });
  expect(f.complete).not.toHaveBeenCalled(); f.connection.emit("authenticationOk", {});
  expect(f.complete).not.toHaveBeenCalled(); f.connection.emit("readyForQuery", { status: "I" });
  expect(f.complete).toHaveBeenCalledExactlyOnceWith(null, f.client);
  f.connection.emit("readyForQuery", { status: "I" }); expect(f.complete).toHaveBeenCalledTimes(1);
});
it.each(["wrong_signature", "missing_signature", "server_controlled_error"])("rejects server-final %s without query handoff or upstream diagnostics", async kind => {
  const f = fixture(); await final(f);
  const data = kind === "wrong_signature" ? `v=${Buffer.alloc(32).toString("base64")}` : kind === "server_controlled_error" ? "e=synthetic_private_input" : "x=missing";
  f.connection.emit("authenticationSASLFinal", { data }); f.connection.emit("authenticationOk", {}); f.connection.emit("readyForQuery", {});
  expect(f.complete).toHaveBeenCalledTimes(1); expect(f.complete.mock.calls[0][0]?.message).toBe(unavailable); expect(f.connection.stream.destroyed).toBe(true);
});
it.each(["ready", "end", "close", "duplicate_offer", "stream_swap", "certificate_swap"])("a pending password cannot revive a refused %s connection", async kind => {
  let resolve!: (value: string) => void;
  const pending = new Promise<string>(done => { resolve = done; }), f = fixture(() => pending);
  await tick(); f.connection.emit("authenticationSASL", { mechanisms: ["SCRAM-SHA-256-PLUS"] }); await tick(); expect(f.getter).toHaveBeenCalledTimes(1);
  if (kind === "ready") f.connection.emit("readyForQuery", {});
  if (kind === "end") f.client.end(() => undefined);
  if (kind === "close") f.connection.stream.destroy();
  if (kind === "duplicate_offer") f.connection.emit("authenticationSASL", { mechanisms: ["SCRAM-SHA-256-PLUS"] });
  if (kind === "stream_swap") { const previous = f.connection.stream; f.connection.stream = tlsStream(); previous.destroy(); }
  if (kind === "certificate_swap") Reflect.set(f.connection.stream, "getPeerCertificate", () => ({ raw: Buffer.from("synthetic_private_input") }));
  resolve("synthetic-password-only"); await tick(); await tick();
  expect(f.connection.sent).toEqual([]); expect(f.complete).toHaveBeenCalledTimes(1); expect(f.complete.mock.calls[0][0]?.message).toBe(unavailable);
});
it.each(["ready", "duplicate_continue", "error"])("pending installed crypto emits no final proof after %s refusal", async kind => {
  const sasl = saslModule as { continueSession(...args: unknown[]): Promise<void> };
  const original = sasl.continueSession; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  vi.spyOn(sasl, "continueSession").mockImplementation(async (...args) => { await original(...args); await gate; });
  const f = fixture(), { first } = await initial(f); f.connection.emit("authenticationSASLContinue", { data: first });
  if (kind === "ready") f.connection.emit("readyForQuery", {});
  if (kind === "duplicate_continue") f.connection.emit("authenticationSASLContinue", { data: first });
  if (kind === "error") f.connection.emit("error", new Error("synthetic_private_input"));
  release(); await new Promise(resolve => setTimeout(resolve, 25));
  expect(f.connection.sent.filter(sent => sent.kind === "final")).toEqual([]); expect(f.complete).toHaveBeenCalledTimes(1); expect(f.complete.mock.calls[0][0]?.message).toBe(unavailable);
});
it("new unused strict clients can end without a credential read or connection", async () => {
  const Constructor = requiredChannelBindingClient(Client), password = vi.fn(() => "synthetic");
  const client = new Constructor({ host: "synthetic.invalid", ssl: { rejectUnauthorized: true }, enableChannelBinding: true, password });
  await client.end(); expect(password).not.toHaveBeenCalled();
});

it("refuses private-contract version/function drift before constructing a client", () => {
  const version = pgPackage.version;
  try {
    pgPackage.version = "0.0.0-synthetic";
    expect(() => requiredChannelBindingClient(Client)).toThrow(unavailable);
  } finally { pgPackage.version = version; }
  const sasl = saslModule as Record<string, unknown>, original = sasl.startSession;
  try {
    sasl.startSession = undefined;
    expect(() => requiredChannelBindingClient(Client)).toThrow(unavailable);
  } finally { sasl.startSession = original; }
  const attach: unknown = Reflect.get(Client.prototype, "_attachListeners");
  try {
    Reflect.set(Client.prototype, "_attachListeners", undefined);
    expect(() => requiredChannelBindingClient(Client)).toThrow(unavailable);
  } finally { Reflect.set(Client.prototype, "_attachListeners", attach); }
});
it("direct require retains all original startup fields except options, never ambient PGOPTIONS", () => {
  vi.stubEnv("PGOPTIONS", "synthetic_private_input");
  try {
    const options = postgresConnectionOptions("postgresql://fixture@ep-unit-123.us-east-2.aws.neon.tech/owned?channel_binding=require&socket_timeout=3");
    const config = directNeonSessionOptions(options), Constructor = config.Client!;
    const client = Reflect.construct(Constructor, [config]);
    const startup: unknown = Reflect.get(client, "getStartupConf");
    if (typeof startup !== "function") throw new Error("startup_contract_missing");
    expect(Reflect.apply(startup, client, [])).toEqual({ user: "fixture", database: "owned", application_name: "axiom", statement_timeout: "3000" });
    expect(config.ssl).toEqual({ rejectUnauthorized: true }); expect(config.host).toBe(options.host); expect(config.onConnect).toBeTypeOf("function");
  } finally { vi.unstubAllEnvs(); }
});
