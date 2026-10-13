import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { redactSecrets } from "@/lib/security/secretRedaction";
import { sendSponsorshipNotification } from "@/lib/supporters/email";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!checkRateLimit(`sponsorship:${ip}`)) return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  try {
    const body = await request.json();
    if (clean(body.website)) return NextResponse.json({ accepted: true });
    const name = clean(body.name, 120);
    const email = clean(body.email).toLowerCase();
    const organization = clean(body.organization, 160);
    const range = clean(body.range, 80);
    const message = redactSecrets(clean(body.message, 5_000));
    if (!name || !EMAIL.test(email) || !range || message.length < 20) {
      return NextResponse.json({ error: "Complete the required fields with a valid email and a short note." }, { status: 400 });
    }
    const lead = await prisma.lead.create({
      data: { name, email, source: "founding-supporter-sponsorship", status: "created", fullPayload: { organization, range, message } },
    });
    const delivered = await sendSponsorshipNotification({ name, email, organization, range, message, referenceId: lead.id });
    return NextResponse.json({ accepted: true, referenceId: lead.id, delivery: delivered ? "sent" : "recorded" });
  } catch (error) {
    console.error("[Sponsorship] Inquiry failed:", error);
    return NextResponse.json({ error: "We could not record the inquiry. Email support@visionxixlabs.com." }, { status: 500 });
  }
}
