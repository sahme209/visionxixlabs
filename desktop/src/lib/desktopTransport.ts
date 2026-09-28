import { invoke } from "@tauri-apps/api/core";

const API_ORIGIN = "https://visionxixlabs.com";
const nativeFetch = globalThis.fetch.bind(globalThis);
let bearerToken: string | undefined;

interface NativeHttpResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function apiPath(input: RequestInfo | URL): string | null {
  const raw = input instanceof Request ? input.url : String(input);
  if (raw.startsWith("/api/")) return raw;
  try {
    const url = new URL(raw);
    return url.origin === API_ORIGIN && url.pathname.startsWith("/api/")
      ? `${url.pathname}${url.search}`
      : null;
  } catch {
    return null;
  }
}

export async function desktopFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const path = apiPath(input);
  if (!isTauriRuntime()) return nativeFetch(input, init);
  if (!path) {
    throw new TypeError("The desktop app blocked a request outside the approved product API origin.");
  }

  const sourceHeaders = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => sourceHeaders.set(key, value));
  const headers: Record<string, string> = {};
  sourceHeaders.forEach((value, key) => { headers[key] = value; });
  if (bearerToken && !sourceHeaders.has("authorization")) {
    headers.authorization = `Bearer ${bearerToken}`;
  }
  const body = typeof init.body === "string" ? init.body : undefined;
  const result = await invoke<NativeHttpResponse>("desktop_http_request", {
    request: {
      method: init.method ?? (input instanceof Request ? input.method : "GET"),
      path,
      headers,
      body,
    },
  });
  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

export function setDesktopTransportCredential(token: string | undefined): void {
  bearerToken = token;
}

/**
 * Legacy desktop screens still call browser-relative /api paths. Install one
 * narrow bridge at boot so those requests use the native allow-listed client
 * instead of resolving against tauri://localhost and throwing a URL error.
 */
export function installDesktopFetchBridge(): void {
  if (!isTauriRuntime()) return;
  globalThis.fetch = desktopFetch;
}
