import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { type PairedSession } from "./authSession";
import { verifyAndActivatePairedSession } from "./activeDesktopCredential";
import { desktopClient, type VerifiedDesktopIdentity } from "./desktopClient";
import { readSecret, writeSecret } from "./secureStorage";
import { DESKTOP_VERSION } from "./desktopMetadata";

function trustedPairingOrigin(): string {
  const configured = new URL(desktopClient.config.apiBase);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(configured.hostname);
  if ((configured.protocol !== "https:" && !(configured.protocol === "http:" && local)) || configured.username || configured.password || configured.pathname !== "/" || configured.search || configured.hash) {
    throw new Error("Desktop sign-in requires a secure service origin or local development origin.");
  }
  return configured.origin;
}

function trustedVerificationUrl(value: string, origin: string, challenge: string, intent: DesktopAuthIntent): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("The service returned an invalid desktop sign-in link. Try again."); }
  const keys = [...url.searchParams.keys()];
  if (url.origin !== origin || url.username || url.password || url.hash || url.pathname !== "/desktop/connect" ||
    keys.length !== 2 || !keys.includes("challenge") || !keys.includes("intent") ||
    url.searchParams.get("challenge") !== challenge || url.searchParams.get("intent") !== intent) {
    throw new Error("The service returned an unexpected desktop sign-in link. No browser was opened.");
  }
  return url.toString();
}
const FINGERPRINT_KEY = "desktop.device.fingerprint";

async function deviceFingerprint(): Promise<string> {
  const existing = await readSecret<string>(FINGERPRINT_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  await writeSecret(FINGERPRINT_KEY, value);
  return value;
}

export type DesktopPlatform = "macos-arm" | "macos-intel" | "windows" | "linux" | "unknown";

export function platformFromSystemInfo(platform: string, arch: string): DesktopPlatform {
  const os = platform.toLowerCase();
  const cpu = arch.toLowerCase();
  if (os === "macos") return cpu === "aarch64" || cpu === "arm64" ? "macos-arm" : "macos-intel";
  if (os === "windows") return "windows";
  if (os === "linux") return "linux";
  return "unknown";
}

async function platform(): Promise<DesktopPlatform> {
  try {
    const info = await invoke<{ platform: string; arch: string }>("get_system_info");
    return platformFromSystemInfo(info.platform, info.arch);
  } catch {
    const value = navigator.platform.toLowerCase();
    if (value.includes("win")) return "windows";
    if (value.includes("linux")) return "linux";
    return "unknown";
  }
}

async function jsonRequest<T>(origin: string, path: string, body: unknown, signal?: AbortSignal): Promise<{ response: Response; body: T }> {
  throwIfCancelled(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${origin}${path}`, {
      redirect: "error",
      credentials: "omit",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const parsed = await response.json().catch(() => ({})) as T;
    throwIfCancelled(signal);
    return { response, body: parsed };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal?.aborted) throw new DOMException("Desktop sign-in cancelled.", "AbortError");
      throw new Error("Desktop sign-in timed out while contacting the service.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export type DesktopAuthIntent = "sign_in" | "sign_up";

export async function signInWithBrowser(intent: DesktopAuthIntent, onWaiting: () => void, signal?: AbortSignal, onCommitting?: () => void): Promise<VerifiedDesktopIdentity> {
  throwIfCancelled(signal);
  const origin = trustedPairingOrigin();
  const fingerprint = await deviceFingerprint();
  throwIfCancelled(signal);
  const start = await jsonRequest<{ challenge?: string; verificationUrl?: string; error?: string }>(
    origin, "/api/desktop/pair/start",
    {
      deviceFingerprint: fingerprint,
      deviceLabel: `${navigator.platform || "Desktop"} · Axiom Agent`,
      platform: await platform(),
      desktopVersion: DESKTOP_VERSION,
      intent,
    },
    signal,
  );
  if (!start.response.ok || !start.body.challenge || !start.body.verificationUrl) {
    throw new Error(start.body.error || "Could not start desktop sign-in.");
  }

  throwIfCancelled(signal);
  const verificationUrl = trustedVerificationUrl(start.body.verificationUrl, origin, start.body.challenge, intent);
  if (trustedPairingOrigin() !== origin) throw new Error("The sign-in service changed. Start sign-in again.");
  await open(verificationUrl);
  throwIfCancelled(signal);
  onWaiting();

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await waitForNextPoll(signal);
    const status = await jsonRequest<{
      status?: "pending" | "approved";
      token?: string;
      session?: PairedSession;
      error?: string;
    }>(origin, "/api/desktop/pair/status", {
      challenge: start.body.challenge,
      deviceFingerprint: fingerprint,
    }, signal);
    if (status.response.status === 202) continue;
    if (!status.response.ok) throw new Error(status.body.error || "Desktop sign-in failed.");
    if (status.body.status === "approved" && status.body.token && status.body.session) {
      throwIfCancelled(signal);
      if (trustedPairingOrigin() !== origin) throw new Error("The sign-in service changed. Start sign-in again.");
      const identity = await verifyAndActivatePairedSession(status.body.token, status.body.session, signal, onCommitting);
      throwIfCancelled(signal);
      return identity;
    }
  }
  throw new Error("Sign-in expired. Please try again.");
}

function waitForNextPoll(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Desktop sign-in cancelled.", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new DOMException("Desktop sign-in cancelled.", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, 2000);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Desktop sign-in cancelled.", "AbortError");
}
