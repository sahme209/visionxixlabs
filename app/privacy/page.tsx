"use client";

import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Navigation } from "../../components/Navigation";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      <div className="absolute -top-40 right-0 w-96 h-96 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" aria-hidden />
      <Navigation />

      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-32 pb-16">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <ShieldCheckIcon className="h-14 w-14 text-violet-400 mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-zinc-400 mb-2">
              Last Updated: {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-sm text-zinc-500">
              For enterprise clients, a Data Processing Agreement (DPA) may be executed separately.
            </p>
          </div>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Introduction
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              Vision XIX Labs LLC (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy and personal data. This Privacy Policy explains how we collect, use, disclose, process, and safeguard your information when you use our mobile applications (including VisaNova and RecallEase), our website, and our cloud and AI engineering consulting services (collectively, the &ldquo;Services&rdquo;).
            </p>
            <p className="text-zinc-300 leading-relaxed mb-4">
              This Privacy Policy applies to all users of our Services, including individual consumers and enterprise clients. For enterprise clients with formal agreements, a separate Data Processing Agreement (DPA) may govern data processing activities and will take precedence where applicable.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              Please read this Privacy Policy carefully. By using our Services, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use our Services.
            </p>
          </section>

          {/* Information We Collect - Consumer Apps */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Information We Collect
            </h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3 text-zinc-200">
                Consumer Mobile Applications
              </h3>

              <div className="mb-4">
                <h4 className="text-lg font-semibold mb-2 text-zinc-200">
                  VisaNova - USCIS Case Tracker
                </h4>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  When you use VisaNova, we may collect:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
                  <li><strong>Personal Information:</strong> Name, email address, date of birth, marital status</li>
                  <li><strong>Case Information:</strong> USCIS receipt number, priority date, case type (e.g., I-130, I-129F, I-485), service center, processing path (Consular/AOS), NVC status</li>
                  <li><strong>Location Data:</strong> Country of origin (for processing time calculations)</li>
                  <li><strong>Device Information:</strong> Device type, operating system version, unique device identifiers</li>
                  <li><strong>Usage Data:</strong> App features accessed, time spent in app, error logs (for app improvement)</li>
                </ul>
              </div>

              <div className="mb-4">
                <h4 className="text-lg font-semibold mb-2 text-zinc-200">
                  RecallEase - Health, Routine &amp; Reminder
                </h4>
                <p className="text-zinc-300 leading-relaxed mb-3">
                  When you use RecallEase, we may collect:
                </p>
                <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
                  <li><strong>Personal Information:</strong> Name, email address (if you create an account)</li>
                  <li><strong>Health Data:</strong> Medication schedules, routine reminders, health tracking information you choose to input</li>
                  <li><strong>Device Information:</strong> Device type, operating system version, unique device identifiers</li>
                  <li><strong>Notification Preferences:</strong> Your notification settings and preferences for reminders</li>
                  <li><strong>Usage Data:</strong> App features accessed, reminder interactions, error logs (for app improvement)</li>
                </ul>
                <p className="text-zinc-500 text-sm mt-3 italic bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg">
                  <strong>Important:</strong> All health and medication data you enter in RecallEase is stored locally on your device. We do not have access to your personal health information unless you explicitly choose to sync it to a cloud service (such as iCloud, if enabled).
                </p>
              </div>
            </div>

            {/* Enterprise/B2B Data */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3 text-zinc-200">
                Enterprise Consulting Services
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-3">
                When you engage us for cloud or AI engineering consulting services, we may process:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
                <li><strong>Business Contact Information:</strong> Names, email addresses, phone numbers, job titles of your employees and representatives</li>
                <li><strong>Account and Access Information:</strong> Cloud account identifiers, IAM role information (scoped to project needs), access logs</li>
                <li><strong>Technical Data:</strong> Infrastructure configurations, system logs, performance metrics, cost data (all within your cloud accounts)</li>
                <li><strong>Project Data:</strong> Requirements, specifications, deliverables, documentation created during engagements</li>
                <li><strong>Communication Data:</strong> Emails, meeting notes, support tickets, and other communications related to engagements</li>
              </ul>
              <p className="text-zinc-500 text-sm mt-3 italic bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg">
                <strong>Enterprise Data Handling:</strong> We process your data only as necessary to provide consulting services. We do not access your production data unless explicitly required and authorized. All work is performed using role-based access in your cloud accounts. We do not store copies of your production data outside your cloud environment unless explicitly agreed in writing.
              </p>
            </div>

            {/* Cloud Operator (Axiom) */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3 text-zinc-200">
                Cloud Operator (Axiom) — AWS Credential Handling
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-3">
                When you connect your AWS account through our Cloud Operator product, we use the following approach:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
                <li><strong>Cross-Account AssumeRole:</strong> You create an IAM role in your account that trusts our broker account. We assume this role using AWS STS with a unique External ID to prevent confused-deputy attacks.</li>
                <li><strong>Read-Only Permissions:</strong> The IAM role is scoped to three permissions: <code className="bg-white/[0.06] px-1 rounded text-xs">ec2:Describe*</code>, <code className="bg-white/[0.06] px-1 rounded text-xs">s3:ListAllMyBuckets</code>, and <code className="bg-white/[0.06] px-1 rounded text-xs">sts:GetCallerIdentity</code>. We cannot modify, delete, or write to any resource in your account.</li>
                <li><strong>Temporary Credentials Only:</strong> STS session tokens are valid for 15 minutes and are used in-memory only. We do not store AWS access keys, secret keys, or session tokens.</li>
                <li><strong>Encrypted Connector Storage:</strong> Your IAM Role ARN and External ID are encrypted at rest using AES-256-GCM. These are deleted immediately when you disconnect.</li>
                <li><strong>Scan Results:</strong> We store aggregate data only — instance counts, bucket counts, region lists, and generated insights. No raw AWS API responses or resource-level details are persisted.</li>
                <li><strong>Scan History:</strong> Up to 5 previous scan snapshots are retained for trend comparison. Older snapshots are automatically dropped.</li>
              </ul>
              <p className="text-zinc-500 text-sm mt-3 italic bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg">
                <strong>Revocation:</strong> You can revoke our access at any time by deleting the IAM role from your AWS console. For full technical details, see our <a href="/security" className="text-violet-400 hover:text-violet-300">Security page</a>.
              </p>
            </div>

            {/* Website Usage */}
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-3 text-zinc-200">
                Website and Contact Forms
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-3">
                When you visit our website or submit contact forms, we may collect:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
                <li><strong>Contact Information:</strong> Name, email address, company name, phone number (if provided)</li>
                <li><strong>Inquiry Data:</strong> Information about your cloud provider, company size, technical requirements, and other details you provide</li>
                <li><strong>Technical Data:</strong> IP address, browser type, device information, pages visited, referral sources</li>
                <li><strong>Cookies and Tracking:</strong> We use essential cookies for website functionality. We do not use third-party advertising cookies or tracking pixels.</li>
              </ul>
            </div>
          </section>

          {/* Legal Basis for Processing */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Legal Basis for Processing (GDPR/CCPA)
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              We process personal data based on the following legal bases:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li><strong>Contract Performance:</strong> To fulfill our contractual obligations under consulting agreements and SOWs</li>
              <li><strong>Legitimate Interests:</strong> To provide, maintain, and improve our Services, ensure security, and prevent fraud</li>
              <li><strong>Consent:</strong> Where you have provided explicit consent (e.g., marketing communications, optional features)</li>
              <li><strong>Legal Obligations:</strong> To comply with applicable laws, regulations, and legal processes</li>
            </ul>
            <p className="text-zinc-500 text-sm mt-3">
              For enterprise clients, data processing is governed by the applicable consulting agreement and any executed Data Processing Agreement (DPA).
            </p>
          </section>

          {/* How We Use Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              How We Use Your Information
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Provide, maintain, and improve our Services</li>
              <li>Process your requests and provide customer support</li>
              <li>Send you notifications related to your case (VisaNova) or reminders (RecallEase)</li>
              <li>Deliver consulting services, including cloud infrastructure design, AI system deployment, and related engineering work</li>
              <li>Analyze usage patterns to improve functionality and user experience</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations and respond to legal requests</li>
              <li>Communicate with you about Services, updates, and relevant information (with opt-out options)</li>
            </ul>
            <p className="text-zinc-500 text-sm mt-3 italic bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg">
              <strong>AI Model Training:</strong> We do not use your data (including enterprise client data, USCIS case information, or health data) to train AI models unless explicitly agreed in writing. We use third-party AI services (e.g., OpenAI, Azure OpenAI) only with appropriate data processing agreements and &ldquo;no training&rdquo; terms where available.
            </p>
          </section>

          {/* Data Storage and Security */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Data Storage and Security
            </h2>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2 text-zinc-200">
                Consumer Applications
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-3">
                <strong>Local Storage:</strong> Most data is stored locally on your device using secure storage mechanisms (UserDefaults on iOS, SharedPreferences on Android). This includes profile information, case details (VisaNova), and health data (RecallEase).
              </p>
              <p className="text-zinc-300 leading-relaxed mb-3">
                <strong>Cloud Storage (Optional):</strong> You may choose to enable iCloud sync (iOS) or Google Drive sync (Android) to back up your data across devices. This is entirely optional and controlled by you.
              </p>
              <p className="text-zinc-300 leading-relaxed">
                <strong>Firebase Services:</strong> We use Firebase Cloud Messaging (FCM) to send push notifications. FCM requires a device token, but we do not store your personal information in Firebase unless you explicitly create an account.
              </p>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2 text-zinc-200">
                Enterprise Consulting Services
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-3">
                <strong>Your Cloud Accounts:</strong> We perform work directly in your AWS, Azure, or GCP accounts. Your data, systems, and infrastructure remain in your cloud environment under your control. We do not copy or store your production data outside your cloud accounts unless explicitly required and agreed in writing.
              </p>
              <p className="text-zinc-300 leading-relaxed mb-3">
                <strong>Our Systems:</strong> We may store project documentation, communications, and deliverables in our secure systems (e.g., version control, project management tools). Access is restricted to authorized personnel and protected by encryption, access controls, and audit logging.
              </p>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2 text-zinc-200">
                Security Measures
              </h3>
              <p className="text-zinc-300 leading-relaxed mb-3">
                We implement technical and organizational measures to protect your information, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
                <li>Encryption of data in transit (TLS/SSL) and at rest where applicable</li>
                <li>Role-based access controls and least-privilege principles</li>
                <li>Regular security assessments and vulnerability management</li>
                <li>Secure development practices and code review</li>
                <li>Audit logging and monitoring of access and changes</li>
                <li>Employee training on data protection and security</li>
                <li>Incident response procedures</li>
              </ul>
              <p className="text-zinc-300 leading-relaxed mt-3">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Data Retention
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              We retain your information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li><strong>Consumer Apps:</strong> Data is retained while you use the Apps and for a reasonable period after account deletion or app uninstallation to comply with legal obligations and resolve disputes</li>
              <li><strong>Enterprise Consulting:</strong> Project data and communications are retained for the duration of the engagement and for a period thereafter as required by law or as specified in the consulting agreement (typically 3-7 years for business records)</li>
              <li><strong>Website Data:</strong> Contact form submissions and website analytics data are retained for up to 2 years or until you request deletion</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-3">
              Upon expiration of the retention period, we securely delete or anonymize your information unless we are required to retain it for legal, regulatory, or dispute resolution purposes.
            </p>
          </section>

          {/* Data Sharing and Subprocessors */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Data Sharing and Subprocessors
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>
                <strong>Service Providers (Subprocessors):</strong> We may engage third-party service providers who perform services on our behalf, such as:
                <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                  <li>Cloud hosting providers (AWS, Azure, GCP) for our own infrastructure</li>
                  <li>Email and communication services (Resend, email providers)</li>
                  <li>Analytics and monitoring tools (for our website and services)</li>
                  <li>Payment processors (for consulting services)</li>
                  <li>AI service providers (e.g., OpenAI, Azure OpenAI) only when explicitly used in consulting engagements and with appropriate data processing agreements</li>
                </ul>
                All subprocessors are contractually bound to protect your information and use it only for the purposes we specify.
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose information if required by law, regulation, or legal process, or to protect our rights, property, or safety, or that of others
              </li>
              <li>
                <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity, subject to the same privacy protections
              </li>
              <li>
                <strong>With Your Consent:</strong> We may share information with your explicit consent or as directed by you
              </li>
            </ul>
            <p className="text-zinc-500 text-sm mt-3 italic bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg">
              <strong>Enterprise Clients:</strong> A list of subprocessors used in consulting engagements is available upon request. We will notify you of material changes to subprocessors and provide an opportunity to object where contractually required.
            </p>
          </section>

          {/* International Data Transfers */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              International Data Transfers
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              We are based in the United States. If you are located outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States and other countries where our service providers operate.
            </p>
            <p className="text-zinc-300 leading-relaxed mb-3">
              For enterprise clients subject to GDPR or other data protection laws:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>We rely on Standard Contractual Clauses (SCCs) or other approved transfer mechanisms where required</li>
              <li>Data Processing Agreements (DPAs) govern cross-border transfers for consulting engagements</li>
              <li>We ensure that subprocessors provide adequate protection for your data</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Your Rights and Choices (GDPR/CCPA)
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li><strong>Access:</strong> Request access to and copies of your personal information</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Erasure:</strong> Request deletion of your personal information (subject to legal retention requirements)</li>
              <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
              <li><strong>Data Portability:</strong> Request transfer of your data to another service provider</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
              <li><strong>Opt-Out:</strong> Opt out of marketing communications and certain data uses (CCPA)</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-3">
              To exercise these rights, please contact us at <a href="mailto:support@visionxixlabs.com" className="text-violet-400 hover:text-violet-300">support@visionxixlabs.com</a>. We will respond to your request within 30 days (or as required by applicable law). We may need to verify your identity before processing your request.
            </p>
            <p className="text-zinc-500 text-sm mt-3">
              <strong>Note:</strong> Some rights may be limited for enterprise clients where data processing is necessary for contract performance or where we act as a data processor under your instructions.
            </p>
          </section>

          {/* Data Breach Notification */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Data Breach Notification
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              In the event of a data breach that may affect your personal information, we will:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Investigate the breach and take immediate steps to contain and remediate it</li>
              <li>Notify affected individuals and relevant authorities as required by applicable law (typically within 72 hours for GDPR, as soon as practicable for other jurisdictions)</li>
              <li>Provide information about the nature of the breach, data affected, and steps taken to address it</li>
              <li>For enterprise clients, notify your designated security contact as specified in the consulting agreement or DPA</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Children&apos;s Privacy
            </h2>
            <p className="text-zinc-300 leading-relaxed">
              Our consumer Apps are not intended for children under the age of 13 (or 16 in the EU). We do not knowingly collect personal information from children under these ages. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately. If we become aware that we have collected information from a child under the applicable age, we will delete it promptly.
            </p>
          </section>

          {/* Changes to Privacy Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Changes to This Privacy Policy
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes by:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Posting the updated Privacy Policy on this page with a new &ldquo;Last Updated&rdquo; date</li>
              <li>Sending an email notification to registered users (for material changes)</li>
              <li>For enterprise clients, providing notice as specified in the consulting agreement or DPA</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-3">
              Your continued use of our Services after changes constitutes acceptance of the updated Privacy Policy. If you do not agree, please discontinue use of our Services.
            </p>
          </section>

          {/* Data Processing Agreement */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Data Processing Agreements (Enterprise Clients)
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              For enterprise clients subject to GDPR, CCPA, or other data protection laws, we offer Data Processing Agreements (DPAs) that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Define our roles and responsibilities as a data processor</li>
              <li>Specify data processing purposes, categories, and retention periods</li>
              <li>Outline security measures and breach notification procedures</li>
              <li>Address international data transfers and subprocessor arrangements</li>
              <li>Provide for audit rights and compliance assistance</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-3">
              If you require a DPA, please contact us at <a href="mailto:support@visionxixlabs.com" className="text-violet-400 hover:text-violet-300">support@visionxixlabs.com</a>. We will work with you to execute a DPA that meets your compliance requirements.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">
              Contact Us
            </h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4 mb-3">
              <p className="text-white font-semibold mb-2">
                Vision XIX Labs LLC
              </p>
              <p className="text-zinc-300 mb-1">
                Email:{" "}
                <a
                  href="mailto:support@visionxixlabs.com"
                  className="text-violet-400 hover:text-violet-300"
                >
                  support@visionxixlabs.com
                </a>
              </p>
              <p className="text-zinc-500 text-sm mt-2">
                For privacy-specific inquiries, please include &ldquo;Privacy Policy&rdquo; in the subject line.
              </p>
            </div>
            <p className="text-zinc-500 text-sm">
              <strong>EU Representative:</strong> If you are located in the EU and wish to contact us regarding GDPR-related matters, you may also contact your local data protection authority.
            </p>
          </section>

          {/* Footer Note */}
          <div className="border-t border-white/[0.06] pt-6 mt-8">
            <p className="text-sm text-zinc-500 text-center">
              This Privacy Policy applies to all products and services offered by Vision XIX Labs LLC, including VisaNova and RecallEase mobile applications, our website, and cloud and AI engineering consulting services.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
