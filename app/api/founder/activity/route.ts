import { NextResponse, type NextRequest } from "next/server";
import { founderContext } from "@/lib/founder/founderAccess";
import { readFounderActivity } from "@/lib/founder/founderActivity";
import { readFounderSignals } from "@/lib/founder/founderSignals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

/**
 * GET: recent company activity and current live signals for the founder console. Founder only;
 * anyone else gets 404. `since` (ISO time) limits events to newer ones for polling.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!await founderContext()) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404, headers: noStore });
  const raw = request.nextUrl.searchParams.get("since");
  const since = raw && raw.length <= 40 && Number.isFinite(Date.parse(raw)) ? new Date(raw) : undefined;
  try {
    const [activity, signals] = await Promise.all([readFounderActivity(since), readFounderSignals()]);
    return NextResponse.json({ ok: true, data: { ...activity, signals } }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, error: "activity_unavailable" }, { status: 503, headers: noStore });
  }
}
