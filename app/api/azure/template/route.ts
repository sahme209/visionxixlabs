/**
 * GET /api/azure/template
 *
 * Serves the Axiom Agent Reader ARM template with the platform's
 * service-principal Object ID baked in as the parameter default. The
 * Azure Portal's "Deploy to Azure" page reads this URL, sees no
 * outstanding parameter, and lets the customer click "Review + create"
 * without typing anything.
 *
 * Reads the base template from public/azure/axiom-agent-reader.json
 * and rewrites parameters.axiomPrincipalObjectId.defaultValue.
 */

import { NextResponse, type NextRequest } from "next/server";
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

type ArmTemplate = {
  parameters?: Record<string, { type: string; defaultValue?: unknown; metadata?: unknown }>;
  [k: string]: unknown;
};

export async function GET(_req: NextRequest) {
  const principalObjectId = process.env.AZURE_AXIOM_PRINCIPAL_OBJECT_ID?.trim();
  if (!principalObjectId) {
    return NextResponse.json({
      error: "service_principal_unavailable",
      hint: "Azure connections are not configured yet.",
    }, { status: 503 });
  }

  let raw: string;
  try {
    raw = await readFile(
      path.join(process.cwd(), "public/azure/axiom-agent-reader.json"),
      "utf8",
    );
  } catch {
    return NextResponse.json({ error: "template_read_failed" }, { status: 500 });
  }

  let template: ArmTemplate;
  try {
    template = JSON.parse(raw) as ArmTemplate;
  } catch {
    return NextResponse.json({ error: "template_parse_failed" }, { status: 500 });
  }

  if (template.parameters?.axiomPrincipalObjectId) {
    template.parameters.axiomPrincipalObjectId.defaultValue = principalObjectId;
  }

  return new NextResponse(JSON.stringify(template, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
