import { createRequire } from "node:module";
import { expect, it } from "vitest";
const require = createRequire(import.meta.url);
const dns: typeof import("node:dns") = require("node:dns");
const dgram: typeof import("node:dgram") = require("node:dgram");
const http: typeof import("node:http") = require("node:http");
const { installOwnedAirflowGuard } = require("../../scripts/fixtures/ownedAirflowHttpPreload.cjs");
// Node exposes this native constructor at runtime; @types/node describes only
// the supported createSocket factory and inherits EventEmitter's constructor.
type NativeSocketConstructor = { new(type: "udp4"): import("node:dgram").Socket; prototype: import("node:dgram").Socket };

it("denies every native DNS/UDP entry before no-send sentinels, including captured Resolver and Socket instances", async () => {
  const apis = [dns, dns.promises];
  const constructors = apis.map(api => api.Resolver);
  const instances = constructors.map(Resolver => new Resolver());
  const CapturedSocket = dgram.Socket as unknown as NativeSocketConstructor, capturedCreateSocket = dgram.createSocket;
  const socket = capturedCreateSocket("udp4");
  const saved: Array<[object, string, PropertyDescriptor]> = [];
  const visited = new Set<object>();
  const dnsEntry = /^(lookupService$|resolve|reverse$|setServers$|setLocalAddress$)/;
  const udpEntry = /^(send|connect|bind)/;
  let nativeCalls = 0, readyNotifications = 0;
  const requestDescriptor = Object.getOwnPropertyDescriptor(http, "request")!;
  saved.push([http, "request", requestDescriptor]);
  // The installer's only readiness write delegates to this non-network stub.
  Object.defineProperty(http, "request", { ...requestDescriptor, value: (options: { hostname: string; port: number; path: string }) => {
    expect(options).toMatchObject({ hostname: "127.0.0.1", port: 31003, path: "/__fixture_guard_ready" });
    return { once() { return this; }, end() { readyNotifications++; } };
  } });
  function stub(owner: object, key: string) {
    const descriptor = Object.getOwnPropertyDescriptor(owner, key)!;
    saved.push([owner, key, descriptor]);
    Object.defineProperty(owner, key, { ...descriptor, value: () => { nativeCalls++; throw new Error("no_send_native_sentinel"); } });
  }
  const entries = apis.map(api => Object.keys(api).filter(key => dnsEntry.test(key) && typeof (api as unknown as Record<string, unknown>)[key] === "function"));
  const methods = constructors.map(Resolver => {
    const names = new Set<string>();
    for (let prototype = Resolver.prototype; prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
      for (const key of Object.getOwnPropertyNames(prototype)) if (dnsEntry.test(key) && typeof (prototype as unknown as Record<string, unknown>)[key] === "function") names.add(key);
      if (visited.has(prototype)) continue; visited.add(prototype);
      for (const key of names) if (Object.hasOwn(prototype, key)) stub(prototype, key);
    }
    return [...names];
  });
  for (let index = 0; index < apis.length; index++) for (const key of entries[index]) stub(apis[index], key);
  const udpMethods = Object.getOwnPropertyNames(CapturedSocket.prototype).filter(key => udpEntry.test(key) && typeof (CapturedSocket.prototype as unknown as Record<string, unknown>)[key] === "function");
  for (const key of udpMethods) stub(CapturedSocket.prototype, key);
  let guard: { restore(): void } | undefined;
  const newResolvers: Array<{ cancel(): void }> = [], newSockets: Array<import("node:dgram").Socket> = [];
  try {
    // Exercise the real installer. Every native query/config/send path and
    // its readiness announcement is already stubbed even on a regression.
    guard = installOwnedAirflowGuard({ origins: ["http://127.0.0.1:31001", "http://127.0.0.1:31002"], wireOrigin: "http://127.0.0.1:31003", proof: "a".repeat(32), databaseUrl: "postgresql://fixture:synthetic@127.0.0.1:31004/axiom_auth_http_0123456789ab" });
    expect(await dns.promises.lookup("airflow.fixture.example.test", { all: true })).toEqual([{ address: "203.0.113.42", family: 4 }]);
    expect(await dns.promises.lookup("127.0.0.1")).toEqual({ address: "127.0.0.1", family: 4 });
    await new Promise<void>((resolve, reject) => dns.lookup("airflow.fixture.example.test", { all: true }, (error, addresses) => {
      if (error) { reject(error); return; } expect(addresses).toEqual([{ address: "203.0.113.42", family: 4 }]); resolve();
    }));
    expect(readyNotifications).toBe(1);
    for (let index = 0; index < apis.length; index++) {
      const api = apis[index] as unknown as Record<string, (...args: unknown[]) => unknown>;
      expect.soft(() => new apis[index].Resolver()).toThrow("owned_airflow_dns_denied");
      const captured = new constructors[index](); newResolvers.push(captured);
      for (const resolver of [instances[index], captured]) for (const key of methods[index]) {
        const args: unknown[] = key === "setServers" ? [["127.0.0.1:49153", "[::1]:49153"]] : key === "setLocalAddress" ? ["127.0.0.1", "::1"] : key === "reverse" ? ["127.0.0.1"] : ["fixture.invalid"];
        if (index === 0 && /^(resolve|reverse$)/.test(key)) args.push(() => undefined);
        await expect.soft(Promise.resolve().then(() => (resolver as unknown as Record<string, (...args: unknown[]) => unknown>)[key](...args))).rejects.toThrow("owned_airflow_dns_denied");
      }
      for (const key of entries[index]) {
        const args = key === "setServers" ? [["127.0.0.1:49153"]] : key === "lookupService" ? ["127.0.0.1", 49153] : key === "reverse" ? ["127.0.0.1"] : ["fixture.invalid"];
        await expect.soft(Promise.resolve().then(() => api[key](...args, ...(index === 0 ? [() => undefined] : [])))).rejects.toThrow("owned_airflow_dns_denied");
      }
    }
    expect.soft(() => dgram.createSocket("udp4")).toThrow("owned_airflow_udp_denied");
    expect.soft(() => new (dgram.Socket as unknown as NativeSocketConstructor)("udp4")).toThrow("owned_airflow_udp_denied");
    const constructed = new CapturedSocket("udp4"), created = capturedCreateSocket("udp4"); newSockets.push(constructed, created);
    for (const instance of [socket, constructed, created]) for (const key of udpMethods) expect.soft(() => (instance as unknown as Record<string, (...args: unknown[]) => unknown>)[key](Buffer.from("no-send"), 49153, "127.0.0.1")).toThrow("owned_airflow_udp_denied");
    expect(nativeCalls).toBe(0);
  } finally {
    guard?.restore();
    for (const [owner, key, descriptor] of saved.reverse()) Object.defineProperty(owner, key, descriptor);
    for (const resolver of [...instances, ...newResolvers]) resolver.cancel();
    for (const instance of [socket, ...newSockets]) { try { instance.close(); } catch { /* never bound or sent */ } }
  }
  expect(dns.Resolver).toBe(constructors[0]); expect(dns.promises.Resolver).toBe(constructors[1]); expect(dgram.Socket).toBe(CapturedSocket); expect(dgram.createSocket).toBe(capturedCreateSocket);
});
