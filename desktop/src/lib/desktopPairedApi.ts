/**
 * Stable request boundary for screen-specific paired-desktop APIs.
 *
 * New views call this module rather than adding another method to
 * DesktopClient. Routes remain constrained to /api/desktop and retain the
 * same Bearer credential/error behavior as the primary client.
 */

import { desktopClient, legacyApiError, type ApiResult } from "./desktopClient";

type DesktopRoute = `/api/desktop/${string}`;
type ResponseBody = {
  ok?: boolean;
  data?: unknown;
  error?: string | { userMessage?: string };
  message?: string;
  issues?: Array<{ field?: string; message?: string }>;
};

function headers(): Record<string, string> {
  const value: Record<string, string> = { Accept: "application/json" };
  if (desktopClient.config.sessionToken) value.Authorization = `Bearer ${desktopClient.config.sessionToken}`;
  return value;
}

export async function pairedDesktopGet<T>(path: DesktopRoute): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${desktopClient.config.apiBase}${path}`, {
      headers: headers(),
      credentials: "include",
    });
    const body = (await response.json().catch(() => ({}))) as ResponseBody;
    if (body.ok && body.data !== undefined) return { ok: true, data: body.data as T };
    return { ok: false, error: legacyApiError(body, response.status) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function pairedDesktopPost<T>(path: DesktopRoute, input: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${desktopClient.config.apiBase}${path}`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const body = (await response.json().catch(() => ({}))) as ResponseBody;
    if (body.ok && body.data !== undefined) return { ok: true, data: body.data as T };
    return { ok: false, error: legacyApiError(body, response.status) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
