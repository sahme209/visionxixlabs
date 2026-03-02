"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  XMarkIcon,
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
  const { user, loading: authLoading } = useAuth();
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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchLeads = useCallback(async (cursor?: string) => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", "30");
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  }, [user, statusFilter, search]);

  const fetchDetail = useCallback(async (id: string) => {
    if (!user) return;
    setDetailLoading(true);
    setSelectedLead(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/leads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
  }, [user]);

  const adminAction = async (
    id: string,
    endpoint: "starter/regenerate" | "preview/deploy" | "preview/publish"
  ) => {
    if (!user) return;
    setActionLoading(id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/leads/${id}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && selectedLead?.id === id) {
        const merged = {
          ...selectedLead.fullPayload,
          ...(data.aiStarterPackage && { aiStarterPackage: data.aiStarterPackage }),
          ...(data.previewUrl && { previewUrl: data.previewUrl }),
          ...(data.productionUrl && { productionUrl: data.productionUrl }),
        };
        setSelectedLead((prev) => (prev ? { ...prev, fullPayload: merged } : null));
      } else if (!res.ok) {
        setError(data.error || "Action failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!user) return;
    setUpdatingStatus(id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
    if (user) fetchLeads();
  }, [user, fetchLeads]);

  useEffect(() => {
    if (selectedId) fetchDetail(selectedId);
  }, [selectedId, fetchDetail]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] px-4">
        <p className="text-[var(--text-secondary)] mb-4">Please sign in to access this page.</p>
        <Link
          href="/login?redirect=/admin/leads"
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
            className="mb-6 rounded-xl border border-[var(--uscis-red)]/30 bg-[var(--uscis-red)]/5 px-4 py-3 text-sm text-[var(--uscis-red)]"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="search"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
              className="w-full rounded-xl border border-[var(--border-color)] py-2.5 pl-10 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-[var(--text-tertiary)]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={() => fetchLeads()}
              disabled={loading}
              className="rounded-xl bg-[var(--uscis-blue)] px-4 py-2.5 font-medium text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-60"
            >
              {loading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
          {loading && leads.length === 0 ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent" />
            </div>
          ) : leads.length === 0 ? (
            <div className="py-16 text-center text-[var(--text-tertiary)]">No leads found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-alt)]">
                    <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] hidden sm:table-cell">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)]">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-[var(--text-primary)] hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-alt)]/50"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{lead.name}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] hidden sm:table-cell">{lead.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            lead.status === "won"
                              ? "bg-green-100 text-green-800"
                              : lead.status === "lost"
                                ? "bg-red-100 text-red-800"
                                : lead.status === "contacted"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-tertiary)] hidden md:table-cell">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedId(lead.id)}
                          className="text-[var(--uscis-blue)] hover:underline font-medium"
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
            <div className="border-t border-[var(--border-color)] px-4 py-3">
              <button
                onClick={() => fetchLeads(nextCursor)}
                disabled={loading}
                className="text-sm text-[var(--uscis-blue)] hover:underline font-medium disabled:opacity-60"
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
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-6 py-4">
              <h2 id="lead-detail-title" className="text-lg font-semibold text-[var(--text-primary)]">
                Lead Details
              </h2>
              <button
                onClick={() => { setSelectedId(null); setSelectedLead(null); }}
                className="rounded-lg p-2 text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-alt)]"
                aria-label="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="px-6 py-6">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent" />
                </div>
              ) : selectedLead ? (
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Name</p>
                      <p className="text-[var(--text-primary)]">{selectedLead.name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Email</p>
                      <a href={`mailto:${selectedLead.email}`} className="text-[var(--uscis-blue)] hover:underline">{selectedLead.email}</a>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Phone</p>
                      <p className="text-[var(--text-primary)]">{selectedLead.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Status</p>
                      <select
                        value={selectedLead.status}
                        onChange={(e) => updateStatus(selectedLead.id, e.target.value)}
                        disabled={updatingStatus === selectedLead.id}
                        className="mt-1 rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => adminAction(selectedLead.id, "starter/regenerate")}
                      disabled={actionLoading === selectedLead.id}
                      className="rounded-lg bg-[var(--uscis-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-60"
                    >
                      {actionLoading === selectedLead.id ? "Working…" : "Regenerate AI"}
                    </button>
                    <button
                      onClick={() => adminAction(selectedLead.id, "preview/deploy")}
                      disabled={actionLoading === selectedLead.id}
                      className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] disabled:opacity-60"
                    >
                      Regenerate preview
                    </button>
                    <button
                      onClick={() => adminAction(selectedLead.id, "preview/publish")}
                      disabled={actionLoading === selectedLead.id}
                      className="rounded-lg border border-[var(--uscis-green)] px-4 py-2 text-sm font-medium text-[var(--uscis-green)] hover:bg-[var(--uscis-green)]/10 disabled:opacity-60"
                    >
                      Publish
                    </button>
                  </div>
                  {!!(selectedLead.fullPayload?.previewUrl || selectedLead.fullPayload?.productionUrl) && (
                    <div>
                      <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Preview / Production</p>
                      {selectedLead.fullPayload?.previewUrl ? (
                        <a
                          href={String(selectedLead.fullPayload.previewUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-[var(--uscis-blue)] hover:underline mb-1"
                        >
                          Preview: {String(selectedLead.fullPayload.previewUrl)}
                        </a>
                      ) : null}
                      {selectedLead.fullPayload?.productionUrl ? (
                        <a
                          href={String(selectedLead.fullPayload.productionUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-[var(--uscis-green)] hover:underline"
                        >
                          Production: {String(selectedLead.fullPayload.productionUrl)}
                        </a>
                      ) : null}
                    </div>
                  )}
                  {selectedLead.fullPayload?.aiStarterPackage ? (
                    <details className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                      <summary className="px-4 py-3 cursor-pointer bg-[var(--bg-surface-alt)] font-medium text-[var(--text-primary)]">
                        AI Starter Package
                      </summary>
                      <pre className="p-4 text-xs text-[var(--text-primary)] overflow-x-auto max-h-64 overflow-y-auto">
                        {JSON.stringify(selectedLead.fullPayload.aiStarterPackage, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Full submission</p>
                    <pre className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4 text-xs text-[var(--text-primary)] overflow-x-auto max-h-64 overflow-y-auto">
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
