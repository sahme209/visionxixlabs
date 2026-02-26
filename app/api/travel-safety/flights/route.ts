import { NextResponse } from "next/server";

interface FlightsRequest {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
}

const AIRLINE_NAMES: Record<string, string> = {
  AA: "American Airlines",
  UA: "United Airlines",
  DL: "Delta Air Lines",
  B6: "JetBlue Airways",
  BA: "British Airways",
  LH: "Lufthansa",
  EK: "Emirates",
  QR: "Qatar Airways",
  PK: "Pakistan International Airlines",
  TK: "Turkish Airlines",
  AC: "Air Canada",
  AF: "Air France",
  UN: "Transaero",
  SU: "Aeroflot",
};

/** Map airport codes to Travelpayouts city codes when needed */
const AIRPORT_TO_CITY: Record<string, string> = {
  JFK: "NYC",
  EWR: "NYC",
  LGA: "NYC",
  LAX: "LAX",
  SFO: "SFO",
  ORD: "CHI",
  MIA: "MIA",
  ATL: "ATL",
  DFW: "DFW",
  SEA: "SEA",
  BOS: "BOS",
  IAD: "WAS",
  DCA: "WAS",
  BWI: "WAS",
};

function toOriginCode(code: string): string {
  return AIRPORT_TO_CITY[code] ?? code;
}

async function fetchTravelpayoutsFlights(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string
): Promise<{
  lowestFare: number;
  averageFare: number;
  currency: string;
  offers: { price: number; airline: string; airlineName?: string }[];
} | null> {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) return null;

  const org = toOriginCode(origin);
  const depMonth = departureDate.slice(0, 7);
  const retMonth = returnDate ? returnDate.slice(0, 7) : departureDate.slice(0, 7);

  const params = new URLSearchParams({
    origin: org,
    destination,
    departure_at: depMonth,
    return_at: retMonth,
    one_way: returnDate ? "false" : "true",
    direct: "false",
    sorting: "price",
    cy: "usd",
    market: "us",
    limit: "100",
    unique: "false",
    token,
  });

  const res = await fetch(
    `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params}`,
    { headers: { Accept: "application/json" } }
  );

  if (!res.ok) return null;

  const json = await res.json();
  if (!json.success || !Array.isArray(json.data) || json.data.length === 0) return null;

  const respCurrency = (json.currency ?? "USD").toUpperCase();
  const isRub = respCurrency === "RUB" || respCurrency === "RUBLES";
  const rubToUsd = 97;

  const raw = json.data as Array<{ price?: number; airline?: string }>;
  const offers: { price: number; airline: string; airlineName?: string }[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (item?.price == null) continue;
    let price = typeof item.price === "number" ? item.price : parseFloat(String(item.price));
    if (isRub) price = price / rubToUsd;
    price = Math.round(price * 100) / 100;
    const airline = (item.airline || "??").toUpperCase();
    const key = `${airline}-${price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({
      price,
      airline,
      airlineName: AIRLINE_NAMES[airline],
    });
  }

  if (offers.length === 0) return null;

  const prices = offers.map((o) => o.price);
  const lowestFare = Math.min(...prices);
  const averageFare = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;

  return {
    lowestFare,
    averageFare,
    currency: "USD",
    offers: offers.slice(0, 24),
  };
}

/** Fallback: v1 cheap API (month granularity) when v3 has no data */
async function fetchTravelpayoutsV1Cheap(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string
): Promise<{
  lowestFare: number;
  averageFare: number;
  currency: string;
  offers: { price: number; airline: string; airlineName?: string }[];
} | null> {
  const token = process.env.TRAVELPAYOUTS_API_TOKEN;
  if (!token) return null;

  const org = toOriginCode(origin);
  const depMonth = departureDate.slice(0, 7);
  const retMonth = returnDate ? returnDate.slice(0, 7) : depMonth;

  const params = new URLSearchParams({
    origin: org,
    destination,
    depart_date: depMonth,
    return_date: retMonth,
    currency: "usd",
  });

  const res = await fetch(
    `https://api.travelpayouts.com/v1/prices/cheap?${params}`,
    { headers: { "x-access-token": token } }
  );

  if (!res.ok) return null;

  const json = await res.json();
  if (!json.success || !json.data || typeof json.data !== "object") return null;

  const destData = json.data[destination];
  if (!destData || typeof destData !== "object") return null;

  const offers: { price: number; airline: string; airlineName?: string }[] = [];
  for (const key of Object.keys(destData)) {
    const item = destData[key];
    if (item?.price != null) {
      let price = typeof item.price === "number" ? item.price : parseFloat(String(item.price));
      if (price > 1000) price = price / 97;
      const airline = (item.airline || "??").toUpperCase();
      offers.push({
        price: Math.round(price * 100) / 100,
        airline,
        airlineName: AIRLINE_NAMES[airline],
      });
    }
  }

  if (offers.length === 0) return null;

  const prices = offers.map((o) => o.price);
  const lowestFare = Math.min(...prices);
  const averageFare = Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;

  return {
    lowestFare,
    averageFare,
    currency: "USD",
    offers: offers.slice(0, 24),
  };
}

function generateMockFlights(
  origin: string,
  destination: string,
  departureDate: string
): { lowestFare: number; averageFare: number; currency: string; offers: { price: number; airline: string; airlineName?: string }[] } {
  const base = 350 + Math.floor(Math.random() * 200);
  const offers = [
    { price: base, airline: "AA", airlineName: "American Airlines" },
    { price: base + 45, airline: "UA", airlineName: "United Airlines" },
    { price: base + 80, airline: "DL", airlineName: "Delta Air Lines" },
    { price: base + 25, airline: "B6", airlineName: "JetBlue Airways" },
    { price: base + 120, airline: "BA", airlineName: "British Airways" },
    { price: base + 60, airline: "LH", airlineName: "Lufthansa" },
    { price: base + 95, airline: "EK", airlineName: "Emirates" },
    { price: base + 110, airline: "QR", airlineName: "Qatar Airways" },
    { price: base + 55, airline: "TK", airlineName: "Turkish Airlines" },
    { price: base + 70, airline: "PK", airlineName: "Pakistan International" },
    { price: base + 90, airline: "AC", airlineName: "Air Canada" },
    { price: base + 65, airline: "AF", airlineName: "Air France" },
  ];
  const prices = offers.map((o) => o.price);
  return {
    lowestFare: Math.min(...prices),
    averageFare: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
    currency: "USD",
    offers,
  };
}

export async function POST(request: Request) {
  try {
    const body: FlightsRequest = await request.json();
    const { origin, destination, departureDate, returnDate } = body;

    if (!origin || !destination || !departureDate) {
      return NextResponse.json(
        { error: "Missing required fields: origin, destination, departureDate" },
        { status: 400 }
      );
    }

    let travelpayouts = await fetchTravelpayoutsFlights(
      origin,
      destination,
      departureDate,
      returnDate
    );

    if (!travelpayouts) {
      travelpayouts = await fetchTravelpayoutsV1Cheap(
        origin,
        destination,
        departureDate,
        returnDate
      );
    }

    if (travelpayouts) {
      return NextResponse.json({
        ...travelpayouts,
        source: "travelpayouts",
      });
    }

    const mock = generateMockFlights(origin, destination, departureDate);
    return NextResponse.json({
      ...mock,
      source: "demo",
    });
  } catch (e) {
    console.error("[TravelSafetyFlights] Error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
