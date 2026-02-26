"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useProfile } from "@/hooks/useProfile";
import {
  COUNTRY_ADVISORIES,
  US_AIRPORTS,
  INTERNATIONAL_AIRPORTS,
  ADVISORY_LABELS,
  type CountryAdvisory,
  type AirportInfo,
} from "@/lib/data/travelSafetyData";

const FORM_TYPES = ["US Citizen", "Green Card", "H-1B", "F-1", "L-1", "B-1/B-2", "I-130 (pending)", "I-485 (pending)", "Other"];
const PROCESSING_PATHS = ["Consular", "AOS"] as const;

function getAdvisoryForCountry(country: string): CountryAdvisory | undefined {
  const normalized = country.trim().toLowerCase();
  return COUNTRY_ADVISORIES.find((c) => c.name.toLowerCase() === normalized);
}

function getAirportsForCountry(country: string): AirportInfo[] {
  const normalized = country.trim().toLowerCase();
  return INTERNATIONAL_AIRPORTS.filter((a) => a.country.toLowerCase().includes(normalized) || normalized.includes(a.country.toLowerCase()));
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Safe to travel";
  if (score >= 60) return "Travel with caution";
  if (score >= 40) return "Reconsider travel";
  return "Not recommended";
}

function getScoreHex(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

interface ScoreResponse {
  score: number;
  baseScore: number;
  modifier: number;
  trend: "increasing" | "decreasing" | "stable";
  factors: string[];
  breakdown: {
    visa: { score: number; label: string; details: string };
    country: { score: number; label: string };
    airport: { score: number; label: string };
  };
  label: string;
}

interface FlightsResponse {
  lowestFare: number;
  averageFare: number;
  currency: string;
  offers: { price: number; airline: string; airlineName?: string }[];
  source?: "travelpayouts" | "demo";
}

export default function TravelSafetyPage() {
  const { profile } = useProfile();
  const [formType, setFormType] = useState(profile?.formType || "");
  const [processingPath, setProcessingPath] = useState<"Consular" | "AOS">((profile?.processingPath as "Consular" | "AOS") || "Consular");
  const [destination, setDestination] = useState("");
  const [usAirport, setUsAirport] = useState("");
  const [intlAirport, setIntlAirport] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const [flights, setFlights] = useState<FlightsResponse | null>(null);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState<string | null>(null);
  const [partnerLink, setPartnerLink] = useState<string | null>(null);

  const countries = useMemo(() => COUNTRY_ADVISORIES.map((c) => c.name).sort(), []);
  const destAdvisory = useMemo(() => (destination ? getAdvisoryForCountry(destination) : null), [destination]);
  const intlAirportsForDest = useMemo(() => (destination ? getAirportsForCountry(destination) : []), [destination]);
  const usAirportInfo = useMemo(() => US_AIRPORTS.find((a) => a.code === usAirport), [usAirport]);
  const intlAirportInfo = useMemo(() => INTERNATIONAL_AIRPORTS.find((a) => a.code === intlAirport), [intlAirport]);

  const canFetchScore = usAirport && intlAirport && startDate && endDate;
  const canFetchFlights = usAirport && intlAirport && startDate;

  const fetchScore = useCallback(async () => {
    if (!canFetchScore) return;
    setScoreLoading(true);
    setScoreError(null);
    try {
      const res = await fetch("/api/travel-safety/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departureAirport: usAirport,
          destinationAirport: intlAirport,
          startDate,
          endDate,
          formType: formType || "Other",
          processingPath: formType === "I-130 (pending)" ? processingPath : undefined,
          destinationCountry: destination || intlAirportInfo?.country,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch score");
      setScore(data);
    } catch (e) {
      setScoreError(e instanceof Error ? e.message : "Failed to fetch score");
      setScore(null);
    } finally {
      setScoreLoading(false);
    }
  }, [canFetchScore, usAirport, intlAirport, startDate, endDate, formType, processingPath, destination, intlAirportInfo?.country]);

  const fetchFlights = useCallback(async () => {
    if (!canFetchFlights) return;
    setFlightsLoading(true);
    setFlightsError(null);
    try {
      const res = await fetch("/api/travel-safety/flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: usAirport,
          destination: intlAirport,
          departureDate: startDate,
          returnDate: endDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch flights");
      setFlights(data);
    } catch (e) {
      setFlightsError(e instanceof Error ? e.message : "Failed to fetch flights");
      setFlights(null);
    } finally {
      setFlightsLoading(false);
    }
  }, [canFetchFlights, usAirport, intlAirport, startDate, endDate]);

  useEffect(() => {
    if (canFetchScore) {
      const t = setTimeout(fetchScore, 400);
      return () => clearTimeout(t);
    } else {
      setScore(null);
      setScoreError(null);
    }
  }, [canFetchScore, fetchScore]);

  useEffect(() => {
    if (canFetchFlights) {
      const t = setTimeout(fetchFlights, 500);
      return () => clearTimeout(t);
    } else {
      setFlights(null);
      setFlightsError(null);
    }
  }, [canFetchFlights, fetchFlights]);

  useEffect(() => {
    if (flights && usAirport && intlAirport && startDate) {
      fetch("/api/travel-safety/partner-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: usAirport,
          destination: intlAirport,
          departureDate: startDate,
          returnDate: endDate || undefined,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d?.url && typeof d.url === "string") {
            setPartnerLink(d.url);
          } else {
            setPartnerLink(null);
          }
        })
        .catch(() => {
          setPartnerLink(null);
        });
    } else {
      setPartnerLink(null);
    }
  }, [flights?.source, usAirport, intlAirport, startDate, endDate]);

  const aviasalesUrl = useMemo(() => {
    if (!usAirport || !intlAirport || !startDate) return "";
    const depDD = startDate.slice(8, 10);
    const depMM = startDate.slice(5, 7);
    const retDD = endDate ? endDate.slice(8, 10) : depDD;
    const retMM = endDate ? endDate.slice(5, 7) : depMM;
    return `https://www.aviasales.com/search/${usAirport}${depDD}${depMM}${intlAirport}${retDD}${retMM}1`;
  }, [usAirport, intlAirport, startDate, endDate]);

  // Final tracking URL used for all outbound flight links.
  // Prefer server-generated partnerLink (already includes marker),
  // otherwise fall back to Aviasales search URL with public marker.
  const trackingUrl = useMemo(() => {
    const base = partnerLink || aviasalesUrl;
    if (!base) return "";

    // If we already have a partner link from the API, just use it.
    if (partnerLink) return base;

    const marker = process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER;
    if (!marker) return base;

    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}marker=${encodeURIComponent(marker)}`;
  }, [partnerLink, aviasalesUrl]);

  const chartData = useMemo(() => {
    if (!score) return [];
    const { breakdown } = score;
    return [
      { name: "Visa status", score: breakdown.visa.score, fill: "#0071e3", weight: "40%" },
      { name: "Destination", score: breakdown.country.score, fill: "#5856D6", weight: "40%" },
      { name: "Airports", score: breakdown.airport.score, fill: "#34C759", weight: "20%" },
    ];
  }, [score]);

  const hex = score ? getScoreHex(score.score) : "#94a3b8";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero — Apple-style */}
      <header className="relative overflow-hidden bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,122,255,0.15),transparent_60%)]" aria-hidden />
        <div className="absolute inset-0 w-full opacity-[0.04]">
          <Image src={HERO_IMAGES.airplane} alt="" fill className="object-cover object-center w-full" sizes="100vw" />
        </div>
        <div className="relative w-full mx-auto px-6 sm:px-8 lg:px-12 py-10 sm:py-14">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-2xl">
              <ShieldCheckIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight !text-white">Travel Safety Checker</h1>
              <p className="text-sm mt-1 max-w-xl !text-white/90">
                Date-sensitive safety score and flight prices for your route.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-full">
        {/* Form — Apple-style card */}
        <section className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)]/40 shadow-sm overflow-hidden mb-8">
          <div className="px-6 sm:px-8 py-5 border-b border-[var(--border-color)]/50">
            <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Your trip details</h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">Select airports, dates, and visa status</p>
          </div>
          <div className="p-6 sm:p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Destination country</label>
                <select
                  value={destination}
                  onChange={(e) => { setDestination(e.target.value); setIntlAirport(""); }}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)]/80 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-2 focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500/60 transition-all"
                >
                  <option value="">Select country...</option>
                  {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Visa / status</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)]/80 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-2 focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500/60 transition-all"
                >
                  <option value="">Select...</option>
                  {FORM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Departure (U.S.)</label>
                <select
                  value={usAirport}
                  onChange={(e) => setUsAirport(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)]/80 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-2 focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500/60 transition-all"
                >
                  <option value="">Select airport...</option>
                  {US_AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Arrival (destination)</label>
                <select
                  value={intlAirport}
                  onChange={(e) => setIntlAirport(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)]/80 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-2 focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500/60 transition-all"
                >
                  <option value="">Select airport...</option>
                  {intlAirportsForDest.length > 0
                    ? intlAirportsForDest.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)
                    : INTERNATIONAL_AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.city}, {a.country}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Travel start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)]/80 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-2 focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500/60 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Travel end date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || new Date().toISOString().slice(0, 10)}
                  className="w-full px-4 py-3 rounded-2xl border border-[var(--border-color)]/80 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-2 focus:ring-2 focus:ring-slate-400/40 focus:border-slate-500/60 transition-all"
                />
              </div>
            </div>
            {formType === "I-130 (pending)" && (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Processing path</label>
                <select
                  value={processingPath}
                  onChange={(e) => setProcessingPath(e.target.value as "Consular" | "AOS")}
                  className="w-full max-w-xs px-4 py-3 rounded-2xl border border-[var(--border-color)]/80 bg-[var(--bg-primary)] text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-2 focus:ring-2 focus:ring-slate-400/40 transition-all"
                >
                  <option value="Consular">Consular</option>
                  <option value="AOS">Adjustment of Status (AOS)</option>
                </select>
              </div>
            )}
          </div>
        </section>

        {/* Travel Safety Score — Apple-style */}
        {(canFetchScore || score) && (
          <section className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)]/40 shadow-sm overflow-hidden mb-8">
            <div className="px-6 sm:px-8 py-5 border-b border-[var(--border-color)]/50">
              <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Travel Safety Score</h2>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">{startDate && endDate ? `${startDate} — ${endDate}` : "Selected dates"}</p>
            </div>
            <div className="p-6 sm:p-8">
              {scoreLoading && !score && (
                <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                  <span className="inline-block w-4 h-4 border-2 border-[var(--uscis-blue)] border-t-transparent rounded-full animate-spin" />
                  Calculating score...
                </div>
              )}
              {scoreError && !score && (
                <p className="text-sm text-red-500">{scoreError}</p>
              )}
              {score && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8 mb-8">
                    <div className="flex-shrink-0 flex items-center justify-center">
                      <div className="relative w-36 h-36 sm:w-40 sm:h-40">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15.9155" fill="#0f0f12" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                          <circle
                            cx="18" cy="18" r="15.9155"
                            fill="none"
                            stroke={hex}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray={`${score.score} ${100 - score.score}`}
                            strokeDashoffset="0"
                            style={{ transition: "stroke-dasharray 0.6s ease-out" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center travel-safety-score-inner">
                          <div className="text-center">
                            <span className="text-3xl sm:text-4xl font-bold tabular-nums">{score.score}</span>
                            <span className="text-xs font-medium block mt-0.5">/ 100</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {score.score >= 80 ? <CheckCircleIcon className="w-6 h-6 text-emerald-500" /> : score.score >= 60 ? <InformationCircleIcon className="w-6 h-6 text-orange-500" /> : <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />}
                        <span className="text-lg font-semibold text-[var(--text-primary)]">{score.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        {score.trend === "increasing" && <ArrowTrendingUpIcon className="w-5 h-5 text-orange-500" />}
                        {score.trend === "decreasing" && <ArrowTrendingDownIcon className="w-5 h-5 text-emerald-500" />}
                        {score.trend === "stable" && <MinusIcon className="w-5 h-5 text-[var(--text-tertiary)]" />}
                        <span>
                          Risk projected to {score.trend === "increasing" ? "increase" : score.trend === "decreasing" ? "decrease" : "remain stable"} during your trip
                        </span>
                      </div>
                      {score.factors.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-[var(--text-tertiary)]">
                          {score.factors.slice(0, 3).map((f, i) => (
                            <li key={i}>• {f}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {chartData.length > 0 && (
                    <div className="mb-6">
                      <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Score breakdown</p>
                      <div className="h-32 sm:h-36 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                            <Tooltip
                              contentStyle={{ borderRadius: 12, border: "1px solid var(--border-color)", fontSize: 12 }}
                              formatter={(value, _, props) => [`${value ?? 0}/100 (${(props as { payload: { weight: string } }).payload?.weight ?? ""})`, "Score"]}
                              labelFormatter={() => ""}
                            />
                            <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={28}>
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-color)]/40">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
                          <PaperAirplaneIcon className="w-4 h-4 text-[var(--text-primary)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[var(--text-primary)] text-sm">Visa status</p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{score.breakdown.visa.details}</p>
                          <p className="text-[11px] text-[var(--text-tertiary)] mt-2">{score.breakdown.visa.score}/100 · {score.breakdown.visa.label}</p>
                        </div>
                      </div>
                    </div>
                    {destAdvisory && (
                      <div className="p-5 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-color)]/40">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#5856D6]/10 flex items-center justify-center flex-shrink-0">
                            <MapPinIcon className="w-4 h-4 text-[#5856D6]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[var(--text-primary)] text-sm">{destination || intlAirportInfo?.country}</p>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Level {destAdvisory.level}: {ADVISORY_LABELS[destAdvisory.level]}{destAdvisory.summary ? ` — ${destAdvisory.summary}` : ""}</p>
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">{score.breakdown.country.score}/100 · {score.breakdown.country.label}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {usAirportInfo && intlAirportInfo && (
                      <div className="p-5 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-color)]/40">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#34C759]/10 flex items-center justify-center flex-shrink-0">
                            <ShieldCheckIcon className="w-4 h-4 text-[#34C759]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[var(--text-primary)] text-sm">{usAirportInfo.code} → {intlAirportInfo.code}</p>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{score.breakdown.airport.label}</p>
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-2">{score.breakdown.airport.score}/100</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="mt-4 text-[11px] text-[var(--text-tertiary)]">
                    This tool uses general guidance. Always verify with official sources before travel.
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        {/* Flight pricing — Apple-style */}
        {(canFetchFlights || flights) && (
          <section className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)]/40 shadow-sm overflow-hidden mb-8 min-w-0">
            <div className="px-6 sm:px-8 py-5 border-b border-[var(--border-color)]/50 min-w-0">
              <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Flight pricing</h2>
              <p className="text-sm text-[var(--text-tertiary)] mt-1 break-words">{usAirport} → {intlAirport} · {startDate}{endDate ? ` — ${endDate}` : ""}</p>
            </div>
            <div className="p-6 sm:p-8 min-w-0 overflow-hidden">
              {flightsLoading && !flights && (
                <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm">
                  <span className="inline-block w-4 h-4 border-2 border-[var(--uscis-blue)] border-t-transparent rounded-full animate-spin" />
                  Fetching flight prices...
                </div>
              )}
              {flightsError && !flights && (
                <p className="text-sm text-red-500">{flightsError}</p>
              )}
              {flights && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer min-w-0"
                      >
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-1">
                          <CurrencyDollarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Lowest fare</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight break-words">
                          ${flights.lowestFare.toLocaleString()}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">
                          The best price we’re currently seeing for your exact dates and route.
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1 block">Tap to search &amp; book</p>
                      </a>
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-6 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-color)]/40 hover:border-slate-400/50 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer min-w-0"
                      >
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-1">
                          <CurrencyDollarIcon className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
                          <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Average fare</span>
                        </div>
                        <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight break-words">
                          ${flights.averageFare.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1">
                          A realistic mid-range price for this trip based on current options.
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-1 block">Tap to search &amp; book</p>
                      </a>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Airlines & fares — tap to search</p>
                      <p className="text-[11px] text-[var(--text-secondary)] mb-3">
                        Sample airlines and ballpark prices so you can quickly sense what this route usually costs.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {flights.offers.map((o, i) => (
                          <a
                            key={i}
                            href={trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-4 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-color)]/40 hover:border-slate-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer min-w-0 overflow-hidden"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <p className="font-medium text-[var(--text-primary)] text-sm truncate min-w-0" title={`${o.airline} — ${o.airlineName || "Carrier"}`}>
                                {o.airline} — {o.airlineName || "Carrier"}
                              </p>
                              <p className="text-lg font-semibold text-[var(--text-primary)] flex-shrink-0">
                                ${o.price.toLocaleString()}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                    {flights.source === "demo" && (
                      <div className="mt-8 p-6 rounded-2xl bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 text-center">
                        <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                          Estimated prices. Search Travelpayouts for current fares and earn commissions.
                        </p>
                        <a
                          href={trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-800 dark:bg-slate-600 text-white text-[15px] font-semibold hover:bg-slate-700 dark:hover:bg-slate-500 active:scale-[0.98] transition-all"
                        >
                          Search for flights on Travelpayouts
                          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                </>
              )}
            </div>
          </section>
        )}

        {/* CTA — Apple-style */}
        <section className="rounded-3xl bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-surface-alt)]/40 border border-[var(--border-color)]/40 p-6 sm:p-8 mb-8">
          <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight mb-2">Official travel advisories</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-5">Latest country advisories and re-entry requirements from the U.S. Department of State.</p>
          <a
            href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 dark:bg-slate-600 text-white text-[15px] font-semibold hover:bg-slate-700 dark:hover:bg-slate-500 active:scale-[0.98] transition-all"
          >
            View travel advisories
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
        </section>

        <div className="flex flex-wrap gap-5 text-[15px] pt-2">
          <Link href="/travel-advisories" className="font-medium text-[var(--text-primary)] hover:underline">Travel Advisories</Link>
          <Link href="/step" className="font-medium text-[var(--text-primary)] hover:underline">STEP Hub</Link>
          <Link href="/resources" className="font-medium text-[var(--text-primary)] hover:underline">Resources</Link>
        </div>
      </main>
    </div>
  );
}
