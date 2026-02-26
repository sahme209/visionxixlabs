"use client";

import React, { useState } from "react";
import { VISA_PAUSE_AFFECTED_COUNTRIES } from "@/lib/data/visaPauseCountries";
import {
  ClockIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ScaleIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[var(--border-color)] bg-[var(--bg-surface-alt)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--uscis-blue)]/10 border border-[var(--uscis-blue)]/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-[var(--text-primary)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-4 sm:py-5">{children}</div>
    </div>
  );
}

export default function VisaPauseDetailSections() {
  const [showAllCountries, setShowAllCountries] = useState(false);
  const displayCountries = showAllCountries
    ? VISA_PAUSE_AFFECTED_COUNTRIES
    : VISA_PAUSE_AFFECTED_COUNTRIES.slice(0, 24);

  return (
    <div className="space-y-6">
      {/* Understanding the delay */}
      <SectionCard title="Understanding the visa pause" icon={ClockIcon}>
        <div className="prose prose-sm max-w-none text-[var(--text-primary)]">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
            On <strong>January 21, 2026</strong>, the U.S. Department of State announced an indefinite <strong>freeze on immigrant visa approvals</strong> for nationals of 75 countries. The policy applies regardless of where the applicant lives—a national of an affected country applying from London, Toronto, or anywhere else is subject to the pause.
          </p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
            The State Department cited &quot;public charge&quot; concerns and designated these 75 countries as &quot;high risk&quot; for public benefits usage. Immigration advocates and the lawsuit (CLINIC v. Rubio) argue this justification is unsupported by data and that the policy violates the Immigration and Nationality Act (INA) and the Administrative Procedure Act (APA), which require individualized assessment—not blanket bans by nationality.
          </p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Consular posts have been instructed to <strong>stop scheduling immigrant visa interviews</strong> for affected nationalities. Already-approved visas have been suspended for some applicants, and diversity lottery (DV) winners from affected countries have had visas revoked or put on hold. The delay affects family-based, employment-based, and diversity visa applicants alike.
          </p>
        </div>
      </SectionCard>

      {/* What's delayed in practice */}
      <SectionCard title="What is delayed in practice" icon={ExclamationTriangleIcon}>
        <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
          <li className="flex gap-3">
            <span className="text-[var(--text-primary)] font-bold flex-shrink-0">•</span>
            <span><strong className="text-[var(--text-primary)]">Consular interviews</strong> — Posts are not scheduling new immigrant visa interviews for nationals of the 75 affected countries.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--text-primary)] font-bold flex-shrink-0">•</span>
            <span><strong className="text-[var(--text-primary)]">Already-approved visas</strong> — Some applicants who had visas approved but not yet issued have had those approvals suspended or put on hold.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--text-primary)] font-bold flex-shrink-0">•</span>
            <span><strong className="text-[var(--text-primary)]">Diversity Visa (DV) lottery</strong> — Winners from affected countries have had visas revoked or delayed; the fiscal year deadline adds urgency.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--text-primary)] font-bold flex-shrink-0">•</span>
            <span><strong className="text-[var(--text-primary)]">Family reunification</strong> — U.S. citizens and LPRs are separated from spouses, children, and parents who cannot complete visa processing.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--text-primary)] font-bold flex-shrink-0">•</span>
            <span><strong className="text-[var(--text-primary)]">Employment-based cases</strong> — Workers with approved petitions are stuck in limbo; employers and families are affected.</span>
          </li>
          <li className="flex gap-3">
            <span className="text-[var(--text-primary)] font-bold flex-shrink-0">•</span>
            <span><strong className="text-[var(--text-primary)]">Documentarily qualified (DQ) at NVC</strong> — Applicants who are DQ and would normally be waiting for an interview are not receiving interview dates.</span>
          </li>
        </ul>
      </SectionCard>

      {/* Who is affected – 75 countries */}
      <SectionCard title="75 affected countries" icon={MapPinIcon}>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Nationals of the following countries are subject to the immigrant visa pause. The policy is based on <strong>country of nationality</strong>, not residence. <strong>India, Philippines, Indonesia, Vietnam, Sri Lanka, Kenya, and China</strong> are among the countries <em>not</em> on the list.
        </p>
        <div className="flex flex-wrap gap-2">
          {displayCountries.map((c) => (
            <span
              key={c}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)]"
            >
              {c}
            </span>
          ))}
        </div>
        {!showAllCountries && VISA_PAUSE_AFFECTED_COUNTRIES.length > 24 && (
          <button
            type="button"
            onClick={() => setShowAllCountries(true)}
            className="mt-4 text-sm font-semibold text-[var(--text-primary)] hover:underline"
          >
            Show all {VISA_PAUSE_AFFECTED_COUNTRIES.length} countries
          </button>
        )}
      </SectionCard>

      {/* Timeline of events */}
      <SectionCard title="Timeline of events" icon={CalendarDaysIcon}>
        <ol className="space-y-4 text-sm">
          {[
            { date: "Oct 2025", text: "Immigration advocates raise concerns about proposed visa and public charge policy changes." },
            { date: "Nov 2025", text: "State Department issues new public charge guidance broadening health and family factors." },
            { date: "Jan 21, 2026", text: "State Department announces indefinite freeze on immigrant visa processing for 75 countries; consular posts halt interview scheduling." },
            { date: "Jan 28, 2026", text: "Coalition sends demand letter to State Department; no substantive response." },
            { date: "Feb 2, 2026", text: "CLINIC and coalition file complaint in U.S. District Court, Southern District of New York (docket 1:26-cv-00858)." },
            { date: "Feb 9, 2026", text: "Lawsuit receives widespread media coverage; plaintiffs seek declaratory and injunctive relief." },
            { date: "Next", text: "Plaintiffs expected to file motion for preliminary injunction; government must answer complaint within 60 days of service." },
          ].map((item) => (
            <li key={item.date} className="flex gap-4">
              <span className="flex-shrink-0 w-20 font-semibold text-[var(--text-tertiary)]">{item.date}</span>
              <span className="text-[var(--text-secondary)]">{item.text}</span>
            </li>
          ))}
        </ol>
      </SectionCard>

      {/* What the lawsuit seeks */}
      <SectionCard title="What the lawsuit seeks" icon={ScaleIcon}>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          The complaint in <strong>CLINIC v. Rubio</strong> asks the court to:
        </p>
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li className="flex gap-2">
            <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-[var(--text-primary)]">Declare the policy unlawful</strong> under the APA and INA.</span>
          </li>
          <li className="flex gap-2">
            <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-[var(--text-primary)]">Issue injunctive relief</strong> to restore visa processing for affected nationalities while the case is litigated (preliminary injunction) and permanently (permanent injunction).</span>
          </li>
          <li className="flex gap-2">
            <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-[var(--text-primary)]">Hold that the policy</strong> violates due process and is discriminatory, and lacks a factual basis for the &quot;high risk&quot; designation.</span>
          </li>
        </ul>
        <p className="text-sm text-[var(--text-tertiary)] mt-4">
          Plaintiffs include CLINIC, NILC, CCR, private attorneys, and U.S. citizen plaintiffs. Defendants are Secretary of State Marco Rubio and the U.S. Department of State.
        </p>
      </SectionCard>

      {/* Legal arguments (summary) */}
      <SectionCard title="Legal arguments in the case" icon={DocumentTextIcon}>
        <ul className="space-y-3 text-sm text-[var(--text-secondary)]">
          <li><strong className="text-[var(--text-primary)]">APA violation</strong> — Policy implemented without notice-and-comment rulemaking and lacks statutory authority (5 U.S.C. § 553, § 706(2)(A)).</li>
          <li><strong className="text-[var(--text-primary)]">INA violation</strong> — INA requires individualized public charge assessment; blanket freeze by nationality violates 8 U.S.C. § 1182(a)(4) and visa issuance procedures.</li>
          <li><strong className="text-[var(--text-primary)]">Due process</strong> — Denying visas based solely on nationality without individual consideration violates the Fifth Amendment.</li>
          <li><strong className="text-[var(--text-primary)]">Discriminatory effect</strong> — Policy disproportionately affects nationals of developing and Muslim-majority countries (equal protection).</li>
          <li><strong className="text-[var(--text-primary)]">Lack of factual basis</strong> — The &quot;high risk&quot; claim is unsupported by data and contradicts established public charge assessment (State Farm).</li>
        </ul>
      </SectionCard>

      {/* Who is not affected */}
      <SectionCard title="Countries not on the list" icon={UserGroupIcon}>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Immigrant visa processing continues as normal for nationals of countries <em>not</em> on the 75-country list. These include (among others):
        </p>
        <div className="flex flex-wrap gap-2">
          {["India", "Philippines", "Indonesia", "Vietnam", "China", "Sri Lanka", "Kenya", "Mexico", "El Salvador", "Honduras", "Guatemala", "Dominican Republic", "South Korea", "Japan", "United Kingdom", "Canada"].map((c) => (
            <span
              key={c}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-[var(--text-primary)]"
            >
              {c}
            </span>
          ))}
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-3">
          If your country is not on the affected list, your immigrant visa timeline is not impacted by this pause. You can continue to track your case and NVC/consular progress as usual.
        </p>
      </SectionCard>
    </div>
  );
}
