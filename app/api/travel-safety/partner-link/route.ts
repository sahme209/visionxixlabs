import { NextResponse } from "next/server";

/**
 * Returns a Travelpayouts partner link for Aviasales so commissions are attributed.
 * Uses the Links API when trs is configured; otherwise appends marker to the URL.
 * @see https://support.travelpayouts.com/hc/en-us/articles/25289759198226-API-for-Travelpayouts-partner-links
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { origin, destination, departureDate, returnDate } = body as {
      origin: string;
      destination: string;
      departureDate: string;
      returnDate?: string;
    };

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: "Missing origin, destination, or departureDate" },
        { status: 400 }
      );
    }

    const depDD = departureDate.slice(8, 10);
    const depMM = departureDate.slice(5, 7);
    const retDD = returnDate ? returnDate.slice(8, 10) : depDD;
    const retMM = returnDate ? returnDate.slice(5, 7) : depMM;

    const baseUrl = `https://www.aviasales.com/search/${origin}${depDD}${depMM}${destination}${retDD}${retMM}1`;

    const token = process.env.TRAVELPAYOUTS_API_TOKEN;
    const marker = process.env.TRAVELPAYOUTS_MARKER || "705686";
    const trs = process.env.TRAVELPAYOUTS_TRS;

    if (token && trs) {
      const res = await fetch("https://api.travelpayouts.com/links/v1/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Access-Token": token,
        },
        body: JSON.stringify({
          trs: parseInt(trs, 10),
          marker: parseInt(marker, 10),
          shorten: false,
          links: [{ url: baseUrl, sub_id: "travel_safety" }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const partnerUrl = data?.result?.links?.[0]?.partner_url;
        if (partnerUrl) {
          return NextResponse.json({ url: partnerUrl });
        }
      }
    }

    const url = marker ? `${baseUrl}?marker=${marker}` : baseUrl;
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[PartnerLink] Error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
