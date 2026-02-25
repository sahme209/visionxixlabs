"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@heroicons/react/24/outline";

const STATUSES = ["new", "contacted", "won", "lost"] as const;

interface LeadSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface LeadDetail extends LeadSummary {
  fullPayload: Record<string, unknown>;
}

export default function AdminLeadsPage() {
  const { data: session, status: authStatus } = useSession();
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingScaffold, setGeneratingScaffold] = useState(false);
  const [scaffoldDownloadUrl, setScaffoldDownloadUrl] = useState<string | null>(null);
  const [scaffoldDisabledMessage, setScaffoldDisabledMessage] = useState<string | null>(null);
  const [showAiPackage, setShowAiPackage] = useState(false);

  const fetchLeads = useCallback(async (cursor?: string) => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "30");
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/leads?${params}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) setError("Access denied. Admin required.");
        else setError(data.error || "Failed to load leads");
        setLeads([]);
        return;
      }
      setLeads(data.leads);
      setNextCursor(data.nextCursor);
    } catch {
      setError("Network error");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [session, statusFilter, search]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!session) return;
    setDetailLoading(true);
    setSelectedLead(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) {
        setSelectedLead(data);
      } else {
        setError(data.error || "Failed to load lead");
      }
    } catch {
      setError("Network error");
    } finally {
      setDetailLoading(false);
    }
  }, [session]);

  const updateStatus = async (id: string, status: string) => {
    if (!session) return;
    setUpdatingStatus(id);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => (l.id === id ? { ...l, status, updatedAt: data.updatedAt } : l))
        );
        if (selectedLead?.id === id) {
          setSelectedLead((prev) => (prev ? { ...prev, status } : null));
        }
      } else {
        setError(data.error || "Failed to update");
      }
    } catch {
      setError("Network error");
    } finally {
      setUpdatingStatus(null);
    }
  };

  useEffect(() => {
    if (session) fetchLeads();
  }, [session, fetchLeads]);

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId);
      setScaffoldDownloadUrl(null);
      setScaffoldDisabledMessage(null);
    }
  }, [selectedId, fetchDetail]);

  const regenerateAi = async (id: string) => {
    setRegenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/leads/${id}/starter`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedLead((prev) =>
          prev && prev.id === id
            ? {
                ...prev,
                fullPayload: {
                  ...prev.fullPayload,
                  aiStarterPackage: data.aiStarterPackage,
                  aiStarterError: false,
                },
              }
            : prev
        );
      } else {
        setError(data.error || "Regenerate failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setRegenerating(false);
    }
  };

  const generateScaffold = async (id: string) => {
    setGeneratingScaffold(true);
    setError("");
    setScaffoldDisabledMessage(null);
    setScaffoldDownloadUrl(null);
    try {
      const res = await fetch(`/api/admin/leads/${id}/scaffold`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.downloadUrl) {
        setScaffoldDownloadUrl(data.downloadUrl);
      } else if (res.status === 503) {
        setScaffoldDisabledMessage(data.message || "Scaffold generation is disabled in production. Local filesystem is ephemeral on serverless. Configure S3, R2, or Supabase storage for scaffold artifacts.");
      } else {
        setError(data.error || "Scaffold generation failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setGeneratingScaffold(false);
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent" />
      </div>
    );
  }

  if (authStatus === "unauthenticated" || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] px-4">
        <p className="text-[var(--text-secondary)] mb-4">Please sign in to access this page.</p>
        <Link
          href="/auth/signin?callbackUrl=/admin/leads"
          className="rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--uscis-blue)]"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              Back
            </Link>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Leads</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error && (
          <div
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-gray-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => fetchLeads()}
              disabled={loading}
              className="rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {loading && leads.length === 0 ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-gray-500">No leads found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{lead.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            lead.status === "won" ? "bg-green-100 text-green-800" :
                            lead.status === "lost" ? "bg-red-100 text-red-800" :
                            lead.status === "contacted" ? "bg-blue-100 text-blue-800" :
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedId(lead.id)}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nextCursor && leads.length > 0 && (
            <div className="border-t border-gray-200 px-4 py-3">
              <button
                onClick={() => fetchLeads(nextCursor)}
                disabled={loading}
                className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-60"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      </main>

      {selectedId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-detail-title"
        >
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <h2 id="lead-detail-title" className="text-lg font-semibold">Lead Details</h2>
              <button
                onClick={() => { setSelectedId(null); setSelectedLead(null); }}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : selectedLead ? (
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
                      <p className="font-medium">{selectedLead.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                      <a href={`mailto:${selectedLead.email}`} className="text-blue-600 hover:underline">{selectedLead.email}</a>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Phone</p>
                      <p>{selectedLead.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                      <select
                        value={selectedLead.status}
                        onChange={(e) => updateStatus(selectedLead.id, e.target.value)}
                        disabled={updatingStatus === selectedLead.id}
                        className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedLead.fullPayload?.aiStarterPackage ? (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowAiPackage(!showAiPackage)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-700"
                      >
                        {showAiPackage ? (
                          <ChevronUpIcon className="h-4 w-4" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4" />
                        )}
                        View AI Starter Package
                      </button>
                      {showAiPackage && (
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm max-h-72 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-xs">
                            {JSON.stringify(selectedLead.fullPayload.aiStarterPackage, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => regenerateAi(selectedLead.id)}
                      disabled={regenerating}
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      {regenerating ? "Regenerating…" : "Regenerate AI"}
                    </button>
                    <button
                      onClick={() => generateScaffold(selectedLead.id)}
                      disabled={generatingScaffold}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-200 disabled:opacity-60"
                    >
                      <DocumentDuplicateIcon className="h-4 w-4" />
                      {generatingScaffold ? "Generating…" : "Generate Scaffold"}
                    </button>
                    {scaffoldDownloadUrl && (
                      <a
                        href={scaffoldDownloadUrl}
                        download
                        className="inline-flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-200"
                      >
                        <DocumentTextIcon className="h-4 w-4" />
                        Download Scaffold
                      </a>
                    )}
                    {scaffoldDisabledMessage && (
                      <div className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <p className="font-medium">Scaffold generation disabled in production</p>
                        <p className="mt-1 text-amber-700">{scaffoldDisabledMessage}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Full submission</p>
                    <pre className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto">
                      {JSON.stringify(selectedLead.fullPayload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
