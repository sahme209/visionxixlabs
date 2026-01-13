"use client";

import { ShieldCheckIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Navigation */}
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Privacy Policy Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <ShieldCheckIcon className="h-16 w-16 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Privacy Policy
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
              Vision XIX Labs LLC ("we," "our," or "us") is committed to
              protecting your privacy. This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use
              our mobile applications, including VisaNova and RecallEase (the
              "Apps"), and our website.
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Please read this Privacy Policy carefully. By using our Apps or
              website, you agree to the collection and use of information in
              accordance with this policy.
            </p>
          </section>

          {/* Information We Collect - VisaNova */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Information We Collect
            </h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200">
                VisaNova - USCIS Case Tracker
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                When you use VisaNova, we may collect the following
                information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
                <li>
                  <strong>Personal Information:</strong> Name, email address,
                  date of birth, marital status
                </li>
                <li>
                  <strong>Case Information:</strong> USCIS receipt number,
                  priority date, case type (e.g., I-130, I-129F, I-485), service
                  center, processing path (Consular/AOS), NVC status
                </li>
                <li>
                  <strong>Location Data:</strong> Country of origin (for
                  processing time calculations)
                </li>
                <li>
                  <strong>Device Information:</strong> Device type, operating
                  system version, unique device identifiers
                </li>
                <li>
                  <strong>Usage Data:</strong> App features accessed, time spent
                  in app, error logs (for app improvement)
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200">
                RecallEase - Health, Routine & Reminder
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                When you use RecallEase, we may collect the following
                information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
                <li>
                  <strong>Personal Information:</strong> Name, email address
                  (if you create an account)
                </li>
                <li>
                  <strong>Health Data:</strong> Medication schedules, routine
                  reminders, health tracking information you choose to input
                </li>
                <li>
                  <strong>Device Information:</strong> Device type, operating
                  system version, unique device identifiers
                </li>
                <li>
                  <strong>Notification Preferences:</strong> Your notification
                  settings and preferences for reminders
                </li>
                <li>
                  <strong>Usage Data:</strong> App features accessed, reminder
                  interactions, error logs (for app improvement)
                </li>
              </ul>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-3 italic">
                <strong>Important:</strong> All health and medication data you
                enter in RecallEase is stored locally on your device. We do not
                have access to your personal health information unless you
                explicitly choose to sync it to a cloud service (such as
                iCloud, if enabled).
              </p>
            </div>
          </section>

          {/* How We Use Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              How We Use Your Information
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>Provide, maintain, and improve our Apps and services</li>
              <li>
                Process your requests and provide customer support
              </li>
              <li>
                Send you notifications related to your case (VisaNova) or
                reminders (RecallEase)
              </li>
              <li>
                Analyze usage patterns to improve app functionality and user
                experience
              </li>
              <li>
                Detect, prevent, and address technical issues and security
                threats
              </li>
              <li>
                Comply with legal obligations and respond to legal requests
              </li>
            </ul>
          </section>

          {/* Data Storage */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Data Storage and Security
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              <strong>Local Storage:</strong> Most of your data is stored
              locally on your device using secure storage mechanisms (UserDefaults
              on iOS, SharedPreferences on Android). This includes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4 mb-4">
              <li>Your profile information and case details (VisaNova)</li>
              <li>Your health data and reminders (RecallEase)</li>
              <li>App preferences and settings</li>
            </ul>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              <strong>Cloud Storage (Optional):</strong> You may choose to
              enable iCloud sync (iOS) or Google Drive sync (Android) to back
              up your data across devices. This is entirely optional and
              controlled by you.
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              <strong>Firebase Services:</strong> We use Firebase Cloud
              Messaging (FCM) to send push notifications. FCM requires a device
              token, but we do not store your personal information in Firebase
              unless you explicitly create an account.
            </p>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We implement appropriate technical and organizational measures to
              protect your personal information. However, no method of
              transmission over the Internet or electronic storage is 100%
              secure.
            </p>
          </section>

          {/* Data Sharing */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Data Sharing and Disclosure
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              We do not sell, trade, or rent your personal information to third
              parties. We may share your information only in the following
              circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>
                <strong>Service Providers:</strong> We may share information
                with third-party service providers who perform services on our
                behalf (e.g., Firebase for notifications, analytics providers)
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose information
                if required by law or in response to valid legal requests
              </li>
              <li>
                <strong>Business Transfers:</strong> In the event of a merger,
                acquisition, or sale of assets, your information may be
                transferred
              </li>
              <li>
                <strong>With Your Consent:</strong> We may share information
                with your explicit consent
              </li>
            </ul>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-3 italic">
              <strong>Important:</strong> We do not share your USCIS case
              information or health data with third parties for advertising or
              marketing purposes.
            </p>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Your Rights and Choices
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
              <li>
                <strong>Access:</strong> You can access and review your
                personal information stored in the Apps
              </li>
              <li>
                <strong>Correction:</strong> You can update or correct your
                information directly in the Apps
              </li>
              <li>
                <strong>Deletion:</strong> You can delete your data by
                uninstalling the Apps or using the delete account feature (if
                available)
              </li>
              <li>
                <strong>Opt-Out:</strong> You can opt out of push notifications
                through your device settings or app preferences
              </li>
              <li>
                <strong>Data Portability:</strong> You can export your data
                through the Apps' export features (if available)
              </li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Children's Privacy
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Our Apps are not intended for children under the age of 13. We do
              not knowingly collect personal information from children under 13.
              If you are a parent or guardian and believe your child has provided
              us with personal information, please contact us immediately.
            </p>
          </section>

          {/* Changes to Privacy Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Changes to This Privacy Policy
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify
              you of any changes by posting the new Privacy Policy on this page
              and updating the "Last Updated" date. You are advised to review
              this Privacy Policy periodically for any changes.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Contact Us
            </h2>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us:
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
              This Privacy Policy applies to all products and services offered
              by Vision XIX Labs LLC, including VisaNova and RecallEase mobile
              applications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
