"use client";

import Link from "next/link";

export default function AdminLeadsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4">
      <p className="text-[var(--text-secondary)] mb-4 text-center">
        Lead storage is not configured for VisaNovaWeb. Website requests are sent via email only.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)]"
      >
        Back to Home
      </Link>
    </div>
  );
}
