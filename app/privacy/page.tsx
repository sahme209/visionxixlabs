"use client";

import Link from "next/link";
import Image from "next/image";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { HERO_IMAGES } from "@/lib/images";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Hero - Apple-style dark gradient header */}
      <header className="relative w-full overflow-hidden bg-[var(--hero-dark)] border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,113,227,0.12),transparent_50%)]" aria-hidden />
        {HERO_IMAGES.office && (
          <div className="absolute inset-0 opacity-[0.12]">
            <Image src={HERO_IMAGES.office} alt="" fill className="object-cover" sizes="100vw" />
          </div>
        )}
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue)]/60 to-[var(--uscis-blue)]" />
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center flex-shrink-0">
              <ShieldCheckIcon className="w-6 h-6 !text-white" />
            </div>
            <div>
              <p className="text-[11px] font-medium !text-white uppercase tracking-widest mb-2">
                Your data, protected
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight !text-white leading-[1.2]">
                Privacy Policy
              </h1>
              <p className="mt-2 text-[14px] !text-white">
                Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">1. Introduction</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
              Welcome to VisaNova. We are committed to protecting your privacy and the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services.
            </p>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              By using VisaNova, you agree to the collection and use of information in accordance with this policy. We encourage you to read this document carefully so you understand our practices.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">2. Information We Collect</h2>
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2 mt-4">Information You Provide</h3>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
              We collect information you voluntarily provide when you create an account, fill out forms (immigration form types, priority dates, country of origin), enter your USCIS receipt number, subscribe to premium services, or contact us. This may include your name, email address, and case-related details you choose to share.
            </p>
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2 mt-4">Automatically Collected</h3>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
              Device information, usage data, IP address, and cookies may be collected when you use our services. This helps us improve performance and understand how our tools are used.
            </p>
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2 mt-4">Third-Party Information</h3>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              We may receive information from authentication providers (Google Sign-In), payment processors (Stripe), and analytics services.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">3. How We Use Your Information</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-3">
              We use the information we collect to provide, maintain, and improve our services; process transactions; personalize your experience; send updates and support communications; analyze usage patterns; detect and prevent security threats; and comply with legal obligations. We do not use your case data for advertising or marketing beyond service-related updates.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">4. Information Sharing</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-4">
              We do not sell, trade, or rent your personal information. We may share information with trusted service providers (cloud hosting, payment processors, analytics, email delivery) who assist in operating our services and are contractually obligated to protect your information.
            </p>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              We may disclose information if required by law, to protect our rights or safety, or in the event of a merger or acquisition.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">5. Data Security</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              We implement industry-standard security measures including encryption (SSL/TLS), secure authentication, and regular security assessments. No method of transmission over the internet is 100% secure; we cannot guarantee absolute security.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">6. Your Rights and Choices</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-4">
              You have the right to access, correct, or delete your personal information; opt out of marketing communications; and request a portable copy of your data. Contact us to exercise these rights.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">7. Cookies and Tracking</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              We use cookies to remember preferences, analyze usage, and improve our services. You can control cookies through your browser settings; disabling them may limit certain features.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">8. Children's Privacy</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              Our services are not intended for children under 13. We do not knowingly collect personal information from children under 13 and will delete such information if discovered.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">9. International Data Transfers</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              Your information may be transferred to and processed in countries other than your country of residence. By using our services, you consent to such transfer.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">10. Changes to This Policy</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy, updating the "Last updated" date, and, for significant changes, sending an email notification.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">11. California Privacy Rights</h2>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65] mb-4">
              California residents have additional rights under the CCPA: right to know what information is collected, right to delete, right to opt-out of sale (we do not sell your information), and right to non-discrimination.
            </p>
            <p className="text-[15px] text-[var(--text-secondary)] leading-[1.65]">
              Contact us to exercise these rights.
            </p>
          </section>

          <section className="pt-6 border-t border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3 tracking-tight">12. Contact Us</h2>
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]/80 p-6">
              <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">VisaNova</p>
              <p className="text-[15px] text-[var(--text-secondary)] mb-1">
                <a href="mailto:privacy@visanova.app" className="text-[var(--text-primary)] hover:underline">privacy@visanova.app</a>
              </p>
              <p className="text-[15px] text-[var(--text-secondary)]">
                <a href="https://visanova.app" className="text-[var(--text-primary)] hover:underline">visanova.app</a>
              </p>
            </div>
          </section>
        </div>

        <nav className="mt-10 pt-6 border-t border-[var(--border-color)] flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          <Link href="/about" className="text-[var(--text-primary)] hover:underline">About</Link>
          <Link href="/terms" className="text-[var(--text-primary)] hover:underline">Terms of Service</Link>
          <Link href="/" className="text-[var(--text-primary)] hover:underline">Home</Link>
        </nav>
      </div>
    </div>
  );
}
