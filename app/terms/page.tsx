"use client";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Navigation } from "../../components/Navigation";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      <div className="absolute -top-40 left-0 w-96 h-96 rounded-full bg-fuchsia-600/5 blur-[120px] pointer-events-none" aria-hidden />
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 md:p-12">
          {/* Header */}
          <div className="text-center mb-12">
            <DocumentTextIcon className="h-14 w-14 text-violet-400 mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-zinc-400 mb-2">
              Last Updated: {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <p className="text-sm text-zinc-500">
              For enterprise clients, these Terms are supplemented by executed consulting agreements and Statements of Work (SOWs).
            </p>
          </div>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Introduction</h2>
            <p className="text-zinc-300 leading-relaxed mb-4">
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the services provided by Vision XIX Labs LLC (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), including our website, cloud and AI engineering consulting services, and mobile applications (collectively, the &ldquo;Services&rdquo;).
            </p>
            <p className="text-zinc-300 leading-relaxed mb-4">
              For enterprise consulting engagements, these Terms are supplemented by separate written agreements, Statements of Work (SOWs), and where applicable, Data Processing Agreements (DPAs). In case of conflict, the executed consulting agreement or SOW takes precedence.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              By accessing or using our Services, you agree to be bound by these Terms. If you disagree with any part of these Terms, you may not access or use our Services.
            </p>
          </section>

          {/* Services Description */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Services Description</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">Vision XIX Labs provides:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Cloud infrastructure engineering and consulting services (AWS, Azure, GCP)</li>
              <li>DevOps and CI/CD automation services</li>
              <li>AI and LLM system integration and deployment services</li>
              <li>Cost optimization and FinOps consulting</li>
              <li>Security and governance consulting</li>
              <li>Mobile applications (VisaNova, RecallEase) and related services</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-4">
              Specific services, deliverables, timelines, fees, acceptance criteria, and performance standards are defined in separate written agreements or Statements of Work (&ldquo;SOWs&rdquo;) for consulting engagements. No work is performed without a written SOW or agreement.
            </p>
          </section>

          {/* Consulting Engagements */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Consulting Engagements</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">For consulting services:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li><strong>Scope and Deliverables:</strong> Scope, deliverables, timelines, acceptance criteria, and fees are defined in a written SOW or agreement. Changes to scope require a written change order or amendment.</li>
              <li><strong>Access Model:</strong> We work using role-based access in your cloud accounts; we do not require root credentials or shared passwords. Access is scoped to the minimum necessary for the engagement.</li>
              <li><strong>Change Management:</strong> All changes are made via Infrastructure-as-Code (IaC) and CI/CD pipelines where applicable. Changes are reviewable, version-controlled, and auditable.</li>
              <li><strong>Documentation:</strong> We provide documentation, runbooks, architecture diagrams, and knowledge transfer as part of deliverables.</li>
              <li><strong>Intellectual Property:</strong> Intellectual property in deliverables (code, documentation, configurations) is assigned to you upon full payment, unless otherwise specified in the SOW.</li>
              <li><strong>Acceptance:</strong> Deliverables are subject to acceptance criteria specified in the SOW. You have a reasonable period (typically 10-14 days) to review and accept deliverables or request revisions.</li>
            </ul>
          </section>

          {/* Use of Services */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Use of Services</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">You agree to:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Provide accurate information and necessary access, credentials, and resources for consulting engagements</li>
              <li>Designate authorized representatives and maintain timely communication</li>
              <li>Use our Services only for lawful purposes and in accordance with these Terms and applicable laws</li>
              <li>Not attempt to gain unauthorized access to our systems or services</li>
              <li>Not use our Services to transmit malicious code, engage in harmful activities, or violate any third-party rights</li>
              <li>Comply with all applicable laws, regulations, and export control requirements</li>
              <li>Ensure you have the right to provide any data, systems, or access you grant to us</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Intellectual Property</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              <strong>Our IP:</strong> Our Services, including our website, methodologies, processes, tools, frameworks, and general knowledge, remain our intellectual property. We retain all rights in our pre-existing IP and any improvements or modifications we make to our own tools and processes.
            </p>
            <p className="text-zinc-300 leading-relaxed mb-3">
              <strong>Deliverables:</strong> For consulting engagements, code, documentation, configurations, architecture designs, and other deliverables created specifically for you (&ldquo;Work Product&rdquo;) are assigned to you upon full payment, unless otherwise specified in the SOW. You may use Work Product for your internal business purposes. We retain the right to use general methodologies, techniques, and knowledge gained from engagements (but not your specific data or confidential information).
            </p>
            <p className="text-zinc-300 leading-relaxed mb-3">
              <strong>Your Data and Systems:</strong> You retain ownership of your data, systems, infrastructure, and any pre-existing IP you provide. We do not claim ownership of your data, systems, or infrastructure. We will not use your data or systems for any purpose other than providing Services under the applicable SOW.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              <strong>Open Source:</strong> Deliverables may include open-source software components subject to their respective licenses. We will identify open-source components and their licenses in documentation.
            </p>
          </section>

          {/* Payment Terms */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Payment Terms</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              Payment terms for consulting services are specified in the applicable SOW or agreement. Unless otherwise specified:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Fees are due as specified in the SOW (e.g., upon completion of milestones, monthly for retainer engagements, or net 30 days from invoice date)</li>
              <li>Late payments may incur interest charges at the rate of 1.5% per month (18% annually) or the maximum rate permitted by law, whichever is lower</li>
              <li>We reserve the right to suspend services for non-payment after written notice and a 15-day cure period</li>
              <li>You are responsible for all taxes, duties, and government charges (excluding taxes on our income)</li>
              <li>All fees are non-refundable except as expressly provided in the SOW or required by law</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-3">
              For fixed-price engagements, payment is typically tied to milestone completion and acceptance. For time-and-materials engagements, fees are based on actual time spent at agreed hourly rates.
            </p>
          </section>

          {/* Confidentiality and Non-Disclosure */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Confidentiality and Non-Disclosure</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              Both parties acknowledge that they may receive confidential information from the other party. &ldquo;Confidential Information&rdquo; includes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Your business plans, financial information, customer data, technical specifications, and proprietary systems</li>
              <li>Our methodologies, tools, pricing, and internal processes</li>
              <li>Any information marked as confidential or that would reasonably be considered confidential</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-3 mt-3">Each party agrees to:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Hold Confidential Information in strict confidence and use it only for the purposes of providing or receiving Services</li>
              <li>Not disclose Confidential Information to third parties except as necessary to provide Services (e.g., to authorized subcontractors bound by confidentiality) or as required by law</li>
              <li>Take reasonable measures to protect Confidential Information, at least equivalent to those used to protect its own confidential information</li>
              <li>Return or destroy Confidential Information upon termination or expiration of the engagement, except as required for legal or regulatory compliance</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-3">
              Confidential Information does not include information that: (a) is publicly available or becomes publicly available through no breach of these Terms, (b) was rightfully known by the receiving party before disclosure, (c) is independently developed without use of Confidential Information, or (d) is rightfully received from a third party without breach of confidentiality.
            </p>
            <p className="text-zinc-500 text-sm mt-3 italic bg-white/[0.02] border border-white/[0.06] p-3 rounded-lg">
              <strong>Formal NDAs:</strong> For enterprise engagements, formal Non-Disclosure Agreements (NDAs) may be executed separately and will supplement these Terms.
            </p>
          </section>

          {/* Data Protection and Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Data Protection and Privacy</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              We process personal data in accordance with our Privacy Policy and applicable data protection laws (including GDPR, CCPA, and others). For enterprise clients:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>We act as a data processor when processing personal data on your behalf under your instructions</li>
              <li>We implement appropriate technical and organizational measures to protect personal data</li>
              <li>We will notify you promptly of any data breaches affecting your data</li>
              <li>We will assist you in responding to data subject requests and regulatory inquiries</li>
              <li>We will not use your data to train AI models unless explicitly agreed in writing</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-3">
              A separate Data Processing Agreement (DPA) may be executed for engagements involving significant processing of personal data subject to GDPR or other data protection laws.
            </p>
          </section>

          {/* Warranties and Disclaimers */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Warranties and Disclaimers</h2>
            <p className="text-zinc-300 leading-relaxed mb-3"><strong>Our Warranties:</strong> We warrant that:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Services will be performed in a professional and workmanlike manner consistent with industry standards</li>
              <li>We have the right and authority to enter into these Terms and provide Services</li>
              <li>Deliverables will not infringe third-party intellectual property rights (excluding open-source components and your-provided materials)</li>
              <li>We will comply with applicable laws in providing Services</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-3 mt-3">
              <strong>Disclaimers:</strong> EXCEPT AS EXPRESSLY PROVIDED ABOVE, OUR SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR UNINTERRUPTED OR ERROR-FREE OPERATION.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              We do not warrant that Services will meet all of your requirements, that results will be error-free, or that defects will be corrected. We are not responsible for issues arising from: (a) changes made outside our scope or after handover, (b) your failure to follow our recommendations or documentation, (c) third-party systems or services, or (d) force majeure events.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Limitation of Liability</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>IN NO EVENT SHALL WE BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO THESE TERMS OR SERVICES</li>
              <li>OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR SERVICES SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO US FOR THE SPECIFIC ENGAGEMENT GIVING RISE TO THE CLAIM IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM</li>
              <li>WE ARE NOT RESPONSIBLE FOR ISSUES ARISING FROM CHANGES MADE OUTSIDE OUR SCOPE OR AFTER HANDOVER, YOUR FAILURE TO FOLLOW OUR RECOMMENDATIONS, THIRD-PARTY SYSTEMS OR SERVICES, OR FORCE MAJEURE EVENTS</li>
              <li>THESE LIMITATIONS APPLY REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE) AND EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES</li>
            </ul>
            <p className="text-zinc-500 text-sm mt-3">
              Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above limitations may not apply to you. In such cases, our liability is limited to the maximum extent permitted by law.
            </p>
          </section>

          {/* Indemnification */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Indemnification</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              <strong>Your Indemnification:</strong> You agree to indemnify, defend, and hold harmless Vision XIX Labs and its officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys&apos; fees) arising out of or relating to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Your use of Services in violation of these Terms or applicable law</li>
              <li>Your data, systems, or materials infringing third-party rights</li>
              <li>Your failure to provide accurate information or necessary access</li>
              <li>Changes made to deliverables by you or third parties after handover</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-3 mt-3">
              <strong>Our Indemnification:</strong> We agree to indemnify, defend, and hold harmless you from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys&apos; fees) arising out of or relating to our infringement of third-party intellectual property rights by deliverables (excluding open-source components and your-provided materials), subject to the limitation of liability above.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              The indemnified party will: (a) promptly notify the indemnifying party of the claim, (b) provide reasonable cooperation, and (c) allow the indemnifying party to control the defense and settlement (provided settlement does not admit liability or impose obligations on the indemnified party).
            </p>
          </section>

          {/* Subcontracting and Assignment */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Subcontracting and Assignment</h2>
            <p className="text-zinc-300 leading-relaxed mb-3"><strong>Subcontracting:</strong> We may engage subcontractors to perform Services, provided that:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>We remain responsible for subcontractor performance</li>
              <li>Subcontractors are bound by confidentiality obligations at least as protective as these Terms</li>
              <li>We notify you of material subcontractors used in engagements (for enterprise clients)</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-3 mt-3">
              <strong>Assignment:</strong> Neither party may assign these Terms or any rights or obligations hereunder without the other party&apos;s prior written consent, except that either party may assign to an affiliate or in connection with a merger, acquisition, or sale of assets (with notice to the other party).
            </p>
          </section>

          {/* Termination */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Termination</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">Either party may terminate a consulting engagement:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>As specified in the applicable SOW or agreement (e.g., upon completion, expiration, or mutual agreement)</li>
              <li>With written notice if the other party materially breaches these Terms or the SOW and fails to cure within thirty (30) days after written notice</li>
              <li>Immediately upon written notice if the other party becomes insolvent, files for bankruptcy, or ceases to conduct business</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mb-3 mt-3">Upon termination:</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>You remain responsible for fees for services rendered and accepted up to the termination date</li>
              <li>We will provide reasonable assistance for handover of deliverables and knowledge transfer</li>
              <li>Each party will return or destroy the other party&apos;s Confidential Information (except as required for legal compliance)</li>
              <li>Provisions that by their nature should survive (confidentiality, IP, indemnification, limitation of liability) will survive termination</li>
            </ul>
          </section>

          {/* Force Majeure */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Force Majeure</h2>
            <p className="text-zinc-300 leading-relaxed">
              Neither party will be liable for delays or failures in performance resulting from circumstances beyond its reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, labor disputes, pandemics, government actions, internet or cloud service outages, or other force majeure events. The affected party will notify the other party promptly and use reasonable efforts to resume performance. If a force majeure event continues for more than thirty (30) days, either party may terminate the affected engagement.
            </p>
          </section>

          {/* Export Control and Compliance */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Export Control and Compliance</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              You agree to comply with all applicable export control laws and regulations, including those of the United States and other jurisdictions. You will not export, re-export, or transfer Services or deliverables in violation of such laws.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              Each party represents that it is not: (a) listed on any government denied-party list, (b) located in or a national of a country subject to comprehensive sanctions, or (c) engaged in activities that would violate applicable sanctions or export control laws.
            </p>
          </section>

          {/* Dispute Resolution */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Dispute Resolution</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              <strong>Informal Resolution:</strong> Before initiating formal proceedings, the parties will attempt to resolve disputes through good faith negotiation. Either party may initiate negotiations by providing written notice to the other party.
            </p>
            <p className="text-zinc-300 leading-relaxed mb-3">
              <strong>Mediation:</strong> If negotiations fail, the parties will attempt to resolve the dispute through mediation with a mutually agreed mediator before pursuing litigation or arbitration.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              <strong>Arbitration or Litigation:</strong> If mediation fails, disputes will be resolved through binding arbitration in accordance with the rules of the American Arbitration Association (AAA) or through courts of competent jurisdiction, as specified in the consulting agreement or SOW. The prevailing party may recover reasonable attorneys&apos; fees and costs.
            </p>
          </section>

          {/* Changes to Terms */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Changes to These Terms</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              We may update these Terms from time to time to reflect changes in our Services, legal requirements, or business practices. We will notify you of material changes by:
            </p>
            <ul className="list-disc list-inside space-y-2 text-zinc-300 ml-4">
              <li>Posting the updated Terms on this page with a new &ldquo;Last Updated&rdquo; date</li>
              <li>Sending an email notification to registered users (for material changes)</li>
              <li>For enterprise clients with active engagements, providing notice as specified in the consulting agreement</li>
            </ul>
            <p className="text-zinc-300 leading-relaxed mt-3">
              Your continued use of our Services after changes constitutes acceptance of the updated Terms. If you do not agree, please discontinue use of our Services. For active consulting engagements, changes will not apply retroactively unless agreed in writing.
            </p>
          </section>

          {/* Governing Law */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Governing Law</h2>
            <p className="text-zinc-300 leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of the United States and the state in which Vision XIX Labs LLC is organized, without regard to conflict of law principles. The United Nations Convention on Contracts for the International Sale of Goods does not apply. Disputes will be resolved as specified in the Dispute Resolution section above.
            </p>
          </section>

          {/* Severability */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Severability and Entire Agreement</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              If any provision of these Terms is found to be invalid, illegal, or unenforceable, the remaining provisions will remain in full force and effect, and the invalid provision will be modified to the minimum extent necessary to make it valid and enforceable.
            </p>
            <p className="text-zinc-300 leading-relaxed">
              These Terms, together with any executed consulting agreements, SOWs, DPAs, and NDAs, constitute the entire agreement between the parties regarding the subject matter hereof and supersede all prior agreements, understandings, and communications, whether written or oral.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-zinc-300 leading-relaxed mb-3">
              If you have questions about these Terms, please contact us:
            </p>
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
              <p className="text-white font-semibold mb-2">Vision XIX Labs LLC</p>
              <p className="text-zinc-300 mb-1">
                Email:{" "}
                <a href="mailto:support@visionxixlabs.com" className="text-violet-400 hover:text-violet-300">
                  support@visionxixlabs.com
                </a>
              </p>
              <p className="text-zinc-500 text-sm mt-2">
                For legal or contract inquiries, please include &ldquo;Terms of Service&rdquo; in the subject line.
              </p>
            </div>
          </section>

          {/* Footer Note */}
          <div className="border-t border-white/[0.06] pt-6 mt-8">
            <p className="text-sm text-zinc-500 text-center">
              These Terms apply to all Services provided by Vision XIX Labs LLC, including consulting services, website access, and mobile applications. For enterprise clients, executed consulting agreements and SOWs take precedence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
