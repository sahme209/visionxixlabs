import { open } from "@tauri-apps/plugin-shell";
import { saveAuthSession, type PairedSession } from "./authSession";
import { readSecret, writeSecret } from "./secureStorage";
import { DESKTOP_VERSION } from "./desktopMetadata";

const API_BASE = "https://visionxixlabs.com";
const FINGERPRINT_KEY = "desktop.device.fingerprint";

async function deviceFingerprint(): Promise<string> {
  const existing = await readSecret<string>(FINGERPRINT_KEY);
  if (existing) return existing;
  const value = crypto.randomUUID();
  await writeSecret(FINGERPRINT_KEY, value);
  return value;
}

function platform(): "macos-arm" | "macos-intel" | "windows" | "linux" | "unknown" {
  const value = navigator.platform.toLowerCase();
  if (value.includes("mac")) return value.includes("arm") ? "macos-arm" : "macos-intel";
  if (value.includes("win")) return "windows";
  if (value.includes("linux")) return "linux";
  return "unknown";
}

async function jsonRequest<T>(path: string, body: unknown): Promise<{ response: Response; body: T }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = await response.json() as T;
  return { response, body: parsed };
}

export async function signInWithBrowser(onWaiting: () => void): Promise<PairedSession> {
  const start = await jsonRequest<{ challenge?: string; verificationUrl?: string; error?: string }>(
    "/api/desktop/pair/start",
    {
      deviceFingerprint: await deviceFingerprint(),
      deviceLabel: `${navigator.platform || "Desktop"} · Axiom Agent`,
      platform: platform(),
      desktopVersion: DESKTOP_VERSION,
    },
  );
  if (!start.response.ok || !start.body.challenge || !start.body.verificationUrl) {
    throw new Error(start.body.error || "Could not start desktop sign-in.");
  }

  await open(start.body.verificationUrl);
  onWaiting();

  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const status = await jsonRequest<{
      status?: "pending" | "approved";
      token?: string;
      session?: PairedSession;
      error?: string;
    }>("/api/desktop/pair/status", { challenge: start.body.challenge });
    if (status.response.status === 202) continue;
    if (!status.response.ok) throw new Error(status.body.error || "Desktop sign-in failed.");
    if (status.body.status === "approved" && status.body.token && status.body.session) {
      await saveAuthSession(status.body.token, status.body.session);
      return status.body.session;
    }
  }
  throw new Error("Sign-in expired. Please try again.");
}
