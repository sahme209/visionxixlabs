import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyBadgeToken } from "@/lib/supporters/core";

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]!);

export async function GET(request: NextRequest, context: { params: Promise<{ purchaseId: string }> }) {
  const { purchaseId } = await context.params;
  const secret = process.env.SUPPORTER_BADGE_SIGNING_SECRET;
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!secret || !verifyBadgeToken(purchaseId, token, secret)) return new NextResponse("Not found", { status: 404 });
  const purchase = await prisma.foundingSupporterPurchase.findUnique({ where: { id: purchaseId } });
  if (!purchase || !["paid", "partially_refunded"].includes(purchase.status)) return new NextResponse("Not found", { status: 404 });
  const name = escapeXml(purchase.displayName || "Founding Supporter");
  const year = purchase.paidAt?.getUTCFullYear() ?? new Date().getUTCFullYear();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#141414"/><circle cx="1050" cy="-10" r="380" fill="#f97316" opacity=".09"/><rect x="55" y="55" width="1090" height="520" rx="28" fill="none" stroke="#fff" stroke-opacity=".12"/><text x="105" y="145" fill="#fb923c" font-family="Arial,sans-serif" font-size="22" letter-spacing="5">VISION XIX LABS</text><text x="105" y="280" fill="#fafafa" font-family="Arial,sans-serif" font-size="66" font-weight="600">Axiom Founding Supporter</text><text x="105" y="370" fill="#a1a1aa" font-family="Arial,sans-serif" font-size="34">${name}</text><text x="105" y="495" fill="#71717a" font-family="Arial,sans-serif" font-size="22">Supporting autonomous engineering · ${year}</text><circle cx="1060" cy="480" r="28" fill="#f97316"/><text x="1060" y="490" text-anchor="middle" fill="#231007" font-family="Arial,sans-serif" font-size="28" font-weight="700">A</text></svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": `attachment; filename="axiom-founding-supporter-${year}.svg"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
