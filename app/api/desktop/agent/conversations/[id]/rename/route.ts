import {NextResponse, type NextRequest} from "next/server";
import {resolveRequestDesktopSession} from "@/lib/desktop/resolveRequestDesktopSession";
import {prisma} from "@/lib/db";
import {consumeToken} from "@/lib/api/rateLimiter";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, {status, headers: {"Cache-Control": "private, no-store"}});
async function smallBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  const reader = request.body?.getReader(); if (!reader) return null;
  try {
    let count = 0, text = ""; const decoder = new TextDecoder("utf-8", {fatal: true});
    while (true) {const chunk = await reader.read(); if (chunk.done) break; count += chunk.value.byteLength; if (count > 2048) {await reader.cancel(); return null;} text += decoder.decode(chunk.value, {stream: true});}
    const body: unknown = JSON.parse(text + decoder.decode()); return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {return null;} finally {reader.releaseLock();}
}
export async function POST(request: NextRequest, {params}: {params: Promise<{id: string}>}): Promise<Response> {
  try {
    const session = await resolveRequestDesktopSession(request, {requiredScope: "pipeline:read", route: "POST /api/desktop/agent/conversations/[id]/rename", allowApiKey: false});
    if (!session) return reply({ok: false, error: "desktop_session_required"}, 401);
    const {id} = await params, body = await smallBody(request);
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id) || !body || Object.keys(body).some(key => !["title", "expectedTitle"].includes(key)) || typeof body.title !== "string" || !body.title.trim() || body.title.length > 200 || /[\x00-\x1f\x7f]/.test(body.title) || !(body.expectedTitle === null || typeof body.expectedTitle === "string" && body.expectedTitle.length <= 200)) return reply({ok: false, error: "invalid_payload"}, 400);
    if (!consumeToken(`conversation-rename:${session.organizationId}:${session.userId}`, {capacity: 10, tokensPerSecond: 1 / 3}).allowed) return reply({ok: false, error: "conversation_rename_rate_limited"}, 429);
    const title = body.title.trim();
    const result = await prisma.agentConversation.updateMany({where: {id, userId: session.userId, organizationId: session.organizationId, title: body.expectedTitle}, data: {title}});
    if (result.count !== 1) return reply({ok: false, error: "conversation_title_changed_or_unavailable"}, 409);
    return reply({ok: true, data: {id, title}});
  } catch {return reply({ok: false, error: "conversation_rename_unconfirmed"}, 503);}
}
