"use client";

import Link from "next/link";
import Image from "next/image";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { HERO_IMAGES } from "@/lib/images";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Hero - Apple-style dark gradient header */}
      <header className="relative w-full overflow-hidden bg-[var(--hero-dark)] border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,113,227,0.12),transparent_50%)]" aria-hidden />
        {HERO_IMAGES.documents && (
          <div className="absolute inset-0 opacity-[0.12]">
            <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="100vw" />
          </div>
        )}
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue)]/60 to-[var(--uscis-blue)]" />
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center flex-shrink-0">
              <DocumentTextIcon className="w-6 h-6 !text-white" />
            </div>
            <div>
              <p className="text-[11px] font-medium !text-white uppercase tracking-widest mb-2">
                Legal
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight !text-white leading-[1.2]">
                Terms of Service
              </h1>
              <p className="mt-2 text-[14px] !text-white">
                Effective {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Summary callout */}
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]/80 p-5 sm:p-6 mb-8">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">Summary</h2>
          <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
            VisaNova provides tools to help you monitor your immigration case status and view processing time estimates. You may only track USCIS receipt numbers you are authorized to track. A paid Premium subscription unlocks additional features such as expedite guidance, action plans, and detailed analytics. You can request deletion of your account and data at any time. By using our services, you agree to these Terms and our{" "}
            <Link href="/privacy" className="text-[var(--text-primary)] hover:underline">Privacy Policy</Link>.
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">1. Parties and Scope</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
              These Terms of Service ("Terms") are an agreement between you and VisaNova. They govern your access to and use of our websites, applications, and related offerings (the "Services").
            </p>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              By using the Services, you agree to these Terms and to our <Link href="/privacy" className="text-[var(--text-primary)] hover:underline">Privacy Policy</Link>, which is incorporated by reference.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">2. Definitions</h2>
            <ul className="space-y-3 text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              <li><strong className="text-[var(--text-primary)]">"USCIS"</strong> means U.S. Citizenship and Immigration Services.</li>
              <li><strong className="text-[var(--text-primary)]">"Receipt Number"</strong> means a USCIS receipt number (case number).</li>
              <li><strong className="text-[var(--text-primary)]">"Case Data"</strong> means information related to a Receipt Number, including case status and metadata.</li>
              <li><strong className="text-[var(--text-primary)]">"Subscription"</strong> means a paid plan enabling additional features.</li>
            </ul>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">3. Eligibility</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              You must be at least 18 years old and able to enter into a binding contract. If you use the Services on behalf of an organization, you represent you have authority to bind that organization.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">4. Services and Disclaimers</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
              VisaNova is an independent service provider. The Services provide informational tools and do not constitute legal advice. Always consult a qualified immigration attorney for legal matters. We do not guarantee approval, timelines, or results. Estimates are based on public data and historical patterns; actual processing times may vary. Our tools are meant to complement, not replace, official USCIS resources.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">5. Receipt Number Authorization</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-4">
              You may only enter or track a Receipt Number if you have explicit authorization from the applicant. We may suspend or terminate accounts we reasonably believe are tracking Receipt Numbers without proper authorization.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">6. USCIS Queries and Limits</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-4">
              VisaNova will query the USCIS Case Status API only for receipt numbers you choose to track, subject to our abuse-prevention controls. Services are limited to a reasonable number of active tracked cases per account.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">7. Accounts and Security</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              You may need to create an account. You agree to provide accurate information, maintain credential confidentiality, and notify us of unauthorized access. You are responsible for activity under your account.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">8. Payments, Cancellation, Refunds</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-4">
              Some Services require payment. If you purchase a Subscription, you authorize recurring charges until you cancel. Cancellations take effect at the end of the current billing period. Fees are generally non-refundable except where required by law.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">9. Acceptable Use</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-4">
              You agree not to scrape, reverse engineer, use for unlawful purposes, or track Receipt Numbers without authorization. You may not interfere with the Services or impose unreasonable load.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">10. Intellectual Property</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              The Services and all associated content are owned by VisaNova or licensors. You receive a limited, revocable, non-transferable license to use the Services under these Terms.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">11. DMCA/Copyright</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              Under the DMCA, VisaNova will remove or disable access to allegedly infringing content upon proper written notice. Contact <a href="mailto:support@visionxixlabs.com" className="text-[var(--text-primary)] hover:underline">support@visionxixlabs.com</a>.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">12. Feedback</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              If you provide suggestions or feedback, you grant VisaNova a non-exclusive, worldwide, royalty-free right to use it.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">13. Third-Party Services</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              The Services may integrate with third-party services (authentication, payment, analytics). See our <Link href="/privacy" className="text-[var(--text-primary)] hover:underline">Privacy Policy</Link> for details.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">14. Privacy</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              Our <Link href="/privacy" className="text-[var(--text-primary)] hover:underline">Privacy Policy</Link> explains what we collect, how we use it, how we share it, and how deletion works.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">15. Term Changes</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              We maintain a record of Terms versions. For material changes, we will ask you to affirmatively accept before continuing. If you do not accept, you may stop using the Services and request deletion.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">16. Disclaimer of Warranties</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              The Services are provided "as is" and "as available." To the maximum extent permitted by law, VisaNova disclaims all warranties, express or implied.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">17. Limitation of Liability</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              VisaNova will not be liable for indirect, incidental, special, consequential, or punitive damages. Total liability will not exceed the amount you paid in the 12 months before the event giving rise to the claim.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">18. Indemnification</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              You agree to indemnify and hold harmless VisaNova from claims arising from your misuse of the Services, violation of these Terms, unauthorized tracking of Receipt Numbers, or violation of applicable law.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">19. Dispute Resolution</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              These Terms are governed by the laws of the United States. Disputes not resolved informally will be resolved by binding arbitration. Either party may seek injunctive relief for misuse of intellectual property.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">20. California Notice</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-4">
              California users: contact us at <a href="mailto:support@visionxixlabs.com" className="text-[var(--text-primary)] hover:underline">support@visionxixlabs.com</a> with questions or complaints. California residents may contact the Division of Consumer Services at 916-445-1254 or 800-952-5210.
            </p>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              See our <Link href="/privacy" className="text-[var(--text-primary)] hover:underline">Privacy Policy</Link> for information on cookies and third-party tracking.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">21. Contact</h2>
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]/80 p-6">
              <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">VisaNova</p>
              <p className="text-[15px] text-[var(--text-secondary)] mb-1">
                <a href="mailto:support@visionxixlabs.com" className="text-[var(--text-primary)] hover:underline">support@visionxixlabs.com</a>
              </p>
              <p className="text-[15px] text-[var(--text-secondary)]">
                <a href="https://visanova.app" className="text-[var(--text-primary)] hover:underline">visanova.app</a>
              </p>
            </div>
          </section>
        </div>

        <nav className="mt-10 pt-6 border-t border-[var(--border-color)] flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          <Link href="/about" className="text-[var(--text-primary)] hover:underline">About</Link>
          <Link href="/privacy" className="text-[var(--text-primary)] hover:underline">Privacy Policy</Link>
          <Link href="/" className="text-[var(--text-primary)] hover:underline">Home</Link>
        </nav>
      </div>
    </div>
  );
}
