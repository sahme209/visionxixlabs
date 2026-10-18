import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { Duplex } from "node:stream";
import { bridgeCommand, bridgeResult, commandDigest, frameReader, openFrame, packFrame, record, sealFrame, type Command, type Manifest, type Result } from "./protocol";
function connection(base: Manifest, nonce: string, id: string): Manifest { return { ...base, session: createHash("sha256").update(base.session + nonce + id).digest("hex").slice(0, 32) }; }
function fields(v: Record<string, unknown>, expected: string[]) { if (Object.keys(v).sort().join("|") !== expected.sort().join("|")) throw new Error("owned_checkout_channel_invalid"); }
const id = () => randomBytes(16).toString("hex");
const duration = (command: Command) => command.kind === "checkout" ? 90000 : command.kind === "reconcile" ? 45000 : 10000;
/** No network factory here. The actual client independently checks its owned
 * filesystem and server binding. Tests use inert Duplex pairs, never sockets. */
export function clientConversation(base: Manifest, wire: Duplex, input: Command): Promise<Result> {
  const command = bridgeCommand(input, base);
  return new Promise(resolve => {
    let phase: "challenge" | "hello" | "result" = "challenge", session: Manifest, requestId = "", expected: Command = { kind: "hello" }, done = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (result: Result) => { if (done) return; done = true; clearTimeout(timer); wire.destroy(); resolve(result); };
    const timeout = (ms: number) => { clearTimeout(timer); timer = setTimeout(() => finish({ kind: "unavailable" }), ms); };
    const send = (body: Command, sequence: number, identity: string) => { expected = body; requestId = identity; wire.write(packFrame(sealFrame(session, "request", sequence, identity, body)), error => { if (error) finish({ kind: "unavailable" }); }); };
    const reader = frameReader(bytes => {
      if (done) return;
      try {
        if (phase === "challenge") {
          const challenge = openFrame(base, "response", 1, bytes), body = record(challenge.body); fields(body, ["kind", "nonce"]);
          if (body.kind !== "challenge" || typeof body.nonce !== "string" || !/^[a-f0-9]{64}$/.test(body.nonce)) throw new Error("owned_checkout_channel_invalid");
          session = connection(base, body.nonce, challenge.id); phase = "hello"; send({ kind: "hello" }, 1, challenge.id); return;
        }
        if (bytes.length > 8192) throw new Error("owned_checkout_channel_invalid");
        const reply = openFrame(session, "response", phase === "hello" ? 1 : 2, bytes), body = record(reply.body); fields(body, ["requestDigest", "result"]);
        if (reply.id !== requestId || body.requestDigest !== commandDigest(expected)) throw new Error("owned_checkout_channel_invalid");
        const result = bridgeResult(body.result);
        if (phase === "hello" && result.kind === "ready" && command.kind !== "hello") { phase = "result"; timeout(duration(command) + 5000); send(command, 2, id()); return; }
        finish(result);
      } catch { finish({ kind: "unavailable" }); }
    });
    wire.on("data", bytes => { try { reader.push(Buffer.from(bytes)); } catch { finish({ kind: "unavailable" }); } });
    wire.once("error", () => finish({ kind: "unavailable" })); wire.once("close", () => finish({ kind: "unavailable" })); wire.once("end", () => { try { reader.end(); } catch { /* unavailable below */ } finish({ kind: "unavailable" }); });
    timeout(5000);
  });
}
/** Exactly one handshake and one command. The supplied supervisor lifetime
 * owner must hard-stop/await its actual worker on deadline. Disconnect does not
 * cancel an accepted service transaction or release its unknown intent fence. */
export function serveConversation(base: Manifest, wire: Duplex, execute: (command: Command) => Promise<Result>, own: (command: Command) => () => void): Promise<void> {
  return new Promise(resolve => {
    const challengeId = id(), nonce = randomBytes(32).toString("hex"), current = connection(base, nonce, challengeId);
    let phase: "hello" | "command" | "pending" | "closed" = "hello", pending = false, resolved = false;
    let timer: ReturnType<typeof setTimeout>;
    const closed = () => { phase = "closed"; clearTimeout(timer); wire.destroy(); if (!pending && !resolved) { resolved = true; resolve(); } };
    const reader = frameReader(bytes => {
      if (phase === "closed") return;
      if (phase === "pending") { closed(); return; }
      try {
        const sequence = phase === "hello" ? 1 : 2, frame = openFrame(current, "request", sequence, bytes), command = bridgeCommand(frame.body, base);
        if (sequence === 1 && (command.kind !== "hello" || frame.id !== challengeId) || sequence === 2 && command.kind === "hello") throw new Error("owned_checkout_channel_invalid");
        const next = sequence === 1 ? "command" : "closed";
        phase = "pending"; pending = true; clearTimeout(timer);
        const release = own(command); let released = false;
        const complete = () => { if (released) return; released = true; release(); pending = false; clearTimeout(timer); };
        timer = setTimeout(closed, duration(command));
        void Promise.resolve().then(() => execute(command)).then(result => {
          const safe = bridgeResult(result); complete();
          if (phase !== "closed") {
            phase = next === "closed" ? "pending" : "command";
            timer = setTimeout(closed, 5000);
            const reply = sealFrame(current, "response", sequence, frame.id, { requestDigest: commandDigest(command), result: safe });
            if (reply.length > 8192) throw new Error("owned_checkout_channel_invalid");
            wire.write(packFrame(reply), error => { if (error || next === "closed" || safe.kind !== "ready" && sequence === 1) closed(); });
          }
        if (phase === "closed") closed();
        }).catch(() => { complete(); closed(); });
      } catch { closed(); }
    });
    wire.on("data", bytes => { try { reader.push(Buffer.from(bytes)); } catch { closed(); } }); wire.once("error", closed); wire.once("close", closed); wire.once("end", () => { try { reader.end(); } catch { /* close without dispatch */ } closed(); });
    timer = setTimeout(closed, 5000);
    wire.write(packFrame(sealFrame(base, "response", 1, challengeId, { kind: "challenge", nonce })), error => { if (error) closed(); });
  });
}
