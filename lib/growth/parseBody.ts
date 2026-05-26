/**
 * Tiny shared parser that accepts either application/json or
 * application/x-www-form-urlencoded / multipart/form-data — used by
 * /api/admin/growth/* routes so admin UI HTML forms work alongside
 * future JSON callers.
 */

import "server-only";

import type { NextRequest } from "next/server";

export async function parseFormOrJson(req: NextRequest): Promise<Record<string, string>> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      const json = (await req.json()) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(json)) {
        if (v === undefined || v === null) continue;
        out[k] = typeof v === "string" ? v : String(v);
      }
      return out;
    } catch {
      return {};
    }
  }
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    try {
      const fd = await req.formData();
      const out: Record<string, string> = {};
      for (const [k, v] of fd.entries()) {
        out[k] = typeof v === "string" ? v : "";
      }
      return out;
    } catch {
      return {};
    }
  }
  return {};
}
