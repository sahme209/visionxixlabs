import { Client, type ClientConfig } from "pg";
import { TLSSocket } from "node:tls";
import pgPackage from "pg/package.json" with { type: "json" };
import saslModule from "pg/lib/crypto/sasl.js";
import certificatesModule from "pg/lib/crypto/cert-signatures.js";

const message = "postgres_channel_binding_required_unavailable";
function unavailable(): never { throw new Error(message); }
type Phase = "awaiting_auth" | "password" | "initial_sent" | "computing" | "final_sent" | "proof_verified" | "authentication_ok" | "connected" | "refused" | "closed";
interface Session { mechanism: string; response: string }
interface Sasl {
  startSession(mechanisms: string[], stream: TLSSocket, max: number): Session;
  continueSession(session: Session, password: string, data: string, stream: TLSSocket): Promise<void>;
  finalizeSession(session: Session, data: string): void;
}
interface Connection {
  stream: TLSSocket;
  on(event: string, callback: (...args: unknown[]) => void): unknown;
  sendSASLInitialResponseMessage(mechanism: string, response: string): void;
  sendSCRAMClientFinalMessage(response: string): void;
}
const methodNames = ["_attachListeners", "_getPassword", "_handleReadyForQuery", "_handleErrorWhileConnecting", "_handleErrorEvent", "_handleErrorMessage"] as const;
type Method = typeof methodNames[number];
function method(object: object, name: string): (...args: unknown[]) => unknown {
  const value: unknown = Reflect.get(object, name);
  if (typeof value !== "function") unavailable();
  return (...args) => Reflect.apply(value, object, args);
}

/** Internal adapter constructor, not an authentication-proof API. Only successful
 * installed SCRAM verification on this physical TLS client can admit Ready.
 * Private pg contracts are version-bound and covered by wire/regression tests. */
export function requiredChannelBindingClient(Base: typeof Client): typeof Client {
  if (pgPackage.version !== "8.23.1") unavailable();
  if (!saslModule || typeof saslModule !== "object" || !certificatesModule || typeof certificatesModule !== "object") unavailable();
  for (const name of ["startSession", "continueSession", "finalizeSession"]) method(saslModule, name);
  const certificateHash = method(certificatesModule, "signatureAlgorithmHashFromCertificate");
  const sasl = saslModule as Sasl;
  const base = Object.fromEntries(methodNames.map(name => {
    const value: unknown = Reflect.get(Client.prototype, name);
    if (typeof value !== "function") unavailable();
    return [name, value];
  })) as Record<Method, (...args: unknown[]) => unknown>;
  const invoke = (name: Method, receiver: object, ...args: unknown[]) => Reflect.apply(base[name], receiver, args);

  return class RequiredChannelBindingClient extends Base {
    #phase: Phase = "awaiting_auth";
    #epoch = 0;
    #session: Session | undefined;
    #stream: TLSSocket | undefined;
    #certificate: Buffer | undefined;
    constructor(config?: string | ClientConfig) {
      if (!config || typeof config !== "object" || !config.ssl || typeof config.ssl !== "object"
        || config.ssl.rejectUnauthorized !== true || config.ssl.checkServerIdentity !== undefined
        || config.enableChannelBinding !== true) unavailable();
      super(config);
    }
    #connection(): Connection {
      const value: unknown = Reflect.get(this, "connection");
      if (!value || typeof value !== "object") unavailable();
      return value as Connection;
    }
    #tls(): TLSSocket {
      const stream = this.#connection().stream;
      if (!(stream instanceof TLSSocket) || !stream.encrypted || stream.authorized !== true
        || stream.authorizationError || stream.destroyed || !stream.writable || Reflect.get(stream, "secureConnecting") !== false) unavailable();
      const certificate: unknown = stream.getPeerCertificate()?.raw;
      if (!Buffer.isBuffer(certificate) || certificate.length === 0 || certificate.length > 262144) unavailable();
      const algorithm = certificateHash(certificate);
      if (typeof algorithm !== "string" || !["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"].includes(algorithm)) unavailable();
      if (this.#stream && (stream !== this.#stream || !this.#certificate?.equals(certificate))) unavailable();
      if (!this.#stream) { this.#stream = stream; this.#certificate = Buffer.from(certificate); }
      return stream;
    }
    #terminal(): boolean { return this.#phase === "refused" || this.#phase === "closed"; }
    #refuse(): void {
      if (this.#terminal()) return;
      this.#phase = "refused"; this.#epoch++; this.#session = undefined;
      Reflect.set(this, "_queryable", false);
      // Report the original connection failure once BEFORE closing its stream.
      // pg-pool's failed-connect branch does not itself destroy that stream.
      try { invoke("_handleErrorWhileConnecting", this, new Error(message)); }
      finally { this.#connection().stream.destroy(); }
    }
    _attachListeners(connection: Connection): void {
      connection.on("authenticationOk", () => {
        if (this.#terminal()) return;
        try {
          if (this.#phase !== "proof_verified") unavailable();
          this.#tls(); this.#phase = "authentication_ok";
        } catch { this.#refuse(); }
      });
      connection.on("end", () => { if (this.#phase !== "connected") this.#refuse(); });
      invoke("_attachListeners", this, connection);
    }
    _handleAuthCleartextPassword(): void { this.#refuse(); }
    _handleAuthMD5Password(): void { this.#refuse(); }
    _handleAuthSASL(msg: unknown): void {
      if (this.#terminal()) return;
      try {
        if (this.#phase !== "awaiting_auth" || !msg || typeof msg !== "object") unavailable();
        const mechanisms: unknown = Reflect.get(msg, "mechanisms");
        if (!Array.isArray(mechanisms) || mechanisms.some(value => typeof value !== "string")
          || !mechanisms.includes("SCRAM-SHA-256-PLUS")) unavailable();
        this.#tls(); this.#phase = "password";
        const epoch = this.#epoch;
        invoke("_getPassword", this, () => {
          if (this.#terminal() || epoch !== this.#epoch) return;
          try {
            if (this.#phase !== "password") unavailable();
            const stream = this.#tls();
            const maximum: unknown = Reflect.get(this, "scramMaxIterations");
            if (typeof maximum !== "number" || maximum !== 100000) unavailable();
            const session = sasl.startSession(["SCRAM-SHA-256-PLUS"], stream, maximum);
            if (session.mechanism !== "SCRAM-SHA-256-PLUS" || typeof session.response !== "string") unavailable();
            this.#session = session; this.#phase = "initial_sent";
            this.#connection().sendSASLInitialResponseMessage(session.mechanism, session.response);
          } catch { this.#refuse(); }
        });
      } catch { this.#refuse(); }
    }
    async _handleAuthSASLContinue(msg: unknown): Promise<void> {
      if (this.#terminal()) return;
      try {
        if (this.#phase !== "initial_sent" || !this.#session || !msg || typeof msg !== "object") unavailable();
        const data: unknown = Reflect.get(msg, "data"), password: unknown = Reflect.get(this, "password");
        if (typeof data !== "string" || typeof password !== "string") unavailable();
        const stream = this.#tls(), session = this.#session, epoch = this.#epoch;
        this.#phase = "computing";
        await sasl.continueSession(session, password, data, stream);
        if (this.#terminal() || epoch !== this.#epoch) return;
        if (this.#phase !== "computing") unavailable();
        this.#tls(); this.#phase = "final_sent";
        this.#connection().sendSCRAMClientFinalMessage(session.response);
      } catch { this.#refuse(); }
    }
    _handleAuthSASLFinal(msg: unknown): void {
      if (this.#terminal()) return;
      try {
        if (this.#phase !== "final_sent" || !this.#session || !msg || typeof msg !== "object") unavailable();
        const data: unknown = Reflect.get(msg, "data");
        if (typeof data !== "string") unavailable();
        this.#tls(); sasl.finalizeSession(this.#session, data);
        this.#session = undefined; this.#phase = "proof_verified";
      } catch { this.#refuse(); }
    }
    _handleReadyForQuery(msg: unknown): void {
      if (this.#terminal()) return;
      try {
        if (this.#phase !== "connected") {
          if (this.#phase !== "authentication_ok") unavailable();
          this.#tls(); this.#phase = "connected";
        }
        invoke("_handleReadyForQuery", this, msg);
      } catch { this.#refuse(); }
    }
    _handleErrorWhileConnecting(): void { this.#refuse(); }
    _handleErrorEvent(error: unknown): void {
      if (this.#phase === "connected") { invoke("_handleErrorEvent", this, error); return; }
      this.#refuse();
    }
    _handleErrorMessage(error: unknown): void {
      if (this.#phase === "connected") { invoke("_handleErrorMessage", this, error); return; }
      this.#refuse();
    }
    end(): Promise<void>;
    end(callback: () => void): void;
    end(callback?: () => void): Promise<void> | void {
      if (this.#phase !== "connected" && Reflect.get(this, "_connecting") === true) this.#refuse();
      this.#phase = "closed"; this.#epoch++; this.#session = undefined;
      return callback ? super.end(callback) : super.end();
    }
  };
}
