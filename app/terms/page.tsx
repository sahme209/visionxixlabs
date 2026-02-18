"use client";

import { DocumentTextIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Navigation } from "../../components/Navigation";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />

      {/* Terms of Service Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <DocumentTextIcon className="h-16 w-16 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Terms of Service
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Last Updated: {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Introduction
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              These Terms of Service ("Terms") govern your access to and use of the services provided by Vision XIX Labs LLC ("we," "our," or "us"), including our website, cloud and AI engineering consulting services, and mobile applications (collectively, the "Services").
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              By accessing or using our Services, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access or use our Services.
            </p>
          </section>

          {/* Services Description */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Services Description
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              Vision XIX Labs provides:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Cloud infrastructure engineering and consulting services (AWS, Azure, GCP)</li>
              <li>DevOps and CI/CD automation services</li>
              <li>AI and LLM system integration and deployment services</li>
              <li>Cost optimization and FinOps consulting</li>
              <li>Security and governance consulting</li>
              <li>Mobile applications (VisaNova, RecallEase) and related services</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
              Specific services, deliverables, timelines, and fees are defined in separate written agreements or statements of work ("SOWs") for consulting engagements.
            </p>
          </section>

          {/* Consulting Engagements */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Consulting Engagements
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              For consulting services:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Scope, deliverables, timelines, and fees are defined in a written SOW or agreement</li>
              <li>We work using role-based access in your cloud accounts; we do not require root credentials</li>
              <li>All changes are made via Infrastructure-as-Code and CI/CD pipelines where applicable</li>
              <li>We provide documentation and runbooks as part of deliverables</li>
              <li>Intellectual property in deliverables (code, documentation, configurations) is assigned to you unless otherwise specified</li>
            </ul>
          </section>

          {/* Use of Services */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Use of Services
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Provide accurate information and necessary access for consulting engagements</li>
              <li>Use our Services only for lawful purposes and in accordance with these Terms</li>
              <li>Not attempt to gain unauthorized access to our systems or services</li>
              <li>Not use our Services to transmit malicious code or engage in harmful activities</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Intellectual Property
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              <strong>Our IP:</strong> Our Services, including our website, methodologies, processes, and general knowledge, remain our intellectual property.
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              <strong>Deliverables:</strong> For consulting engagements, code, documentation, configurations, and other deliverables created specifically for you are assigned to you upon payment, unless otherwise specified in the SOW.
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Your Data:</strong> You retain ownership of your data, systems, and infrastructure. We do not claim ownership of your data or systems.
            </p>
          </section>

          {/* Payment Terms */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Payment Terms
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              Payment terms for consulting services are specified in the applicable SOW or agreement. Generally:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Fees are due as specified in the SOW (e.g., upon completion of milestones or monthly for retainer engagements)</li>
              <li>Late payments may incur interest charges as specified in the SOW</li>
              <li>We reserve the right to suspend services for non-payment after written notice</li>
            </ul>
          </section>

          {/* Confidentiality */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Confidentiality
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              We treat your information, systems, and data as confidential. We:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Do not disclose your confidential information to third parties without your consent</li>
              <li>Use your information only for the purposes of providing Services</li>
              <li>Maintain appropriate security measures to protect your information</li>
              <li>Do not use your information to train AI models unless explicitly agreed in writing</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
              Formal confidentiality agreements (NDAs) may be executed for specific engagements if requested.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Limitation of Liability
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Our Services are provided "as is" without warranties of any kind, express or implied</li>
              <li>We are not liable for indirect, incidental, or consequential damages</li>
              <li>Our total liability is limited to the fees paid for the specific engagement giving rise to the claim</li>
              <li>We are not responsible for issues arising from changes made outside our scope or after handover</li>
            </ul>
          </section>

          {/* Termination */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Termination
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              Either party may terminate a consulting engagement:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>As specified in the applicable SOW or agreement</li>
              <li>With written notice if the other party breaches these Terms and fails to cure within a reasonable period</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mt-4">
              Upon termination, you remain responsible for fees for services rendered up to the termination date. We will provide reasonable assistance for handover of deliverables.
            </p>
          </section>

          {/* Changes to Terms */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Changes to These Terms
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on this page and updating the "Last Updated" date. Your continued use of our Services after changes constitutes acceptance of the updated Terms.
            </p>
          </section>

          {/* Governing Law */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Governing Law
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              These Terms are governed by the laws of the United States and the state in which Vision XIX Labs LLC is organized, without regard to conflict of law principles. Disputes will be resolved through good faith negotiation, and if necessary, through binding arbitration or courts of competent jurisdiction.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Contact Us
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              If you have questions about these Terms, please contact us:
            </p>
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
              <p className="text-slate-800 dark:text-slate-200 font-semibold mb-2">
                Vision XIX Labs LLC
              </p>
              <p className="text-slate-700 dark:text-slate-300">
                Email:{" "}
                <a
                  href="mailto:support@visionxixlabs.com"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  support@visionxixlabs.com
                </a>
              </p>
            </div>
          </section>

          {/* Footer Note */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-8">
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
              These Terms apply to all Services provided by Vision XIX Labs LLC, including consulting services, website access, and mobile applications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
