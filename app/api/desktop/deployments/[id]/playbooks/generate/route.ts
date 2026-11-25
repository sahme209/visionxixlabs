import { NextResponse, type NextRequest } from "next/server";
import { POST as persistPlaybook } from "../route";

export const dynamic = "force-dynamic";

/** A separate endpoint prevents a new desktop from falling back to an old unbound write. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    if (request.nextUrl.searchParams.getAll("expectedVersion").length !== 1) {
        return NextResponse.json({ ok: false, error: "invalid_release_version" }, { status: 400 });
    }
    if (!request.headers.has("x-playbook-attempt-id")) {
        return NextResponse.json({ ok: false, error: "playbook_attempt_required" }, { status: 400 });
    }
    return persistPlaybook(request, context);
}
