/**
 * Vision XIX Labs AI — Knowledge base for RAG-style context injection.
 * Trained on VisaNova content, FAQs, status decoder, and immigration guidance.
 */

import { faqLibrary } from "./faq-data";
import { statusExplanations } from "./statusDecoder";

function extractFAQContent(): string {
  const chunks: string[] = [];
  for (const cat of faqLibrary.categories) {
    if (cat.items.length === 0) continue;
    chunks.push(`\n## ${cat.title}`);
    for (const item of cat.items) {
      if (item.officialAnswer) {
        chunks.push(`Q: ${item.question}\nA: ${item.officialAnswer}`);
      }
    }
  }
  return chunks.join("\n\n");
}

function extractStatusExplanations(): string {
  const chunks: string[] = [];
  for (const [status, exp] of Object.entries(statusExplanations)) {
    chunks.push(`**"${status}"**: ${exp.summary}. ${exp.whatItMeans}. Typical next: ${exp.typicalNext}.${exp.tip ? ` Tip: ${exp.tip}` : ""}`);
  }
  return chunks.join("\n");
}

export function getAIKnowledgeContext(): string {
  const faqContent = extractFAQContent();
  const statusContent = extractStatusExplanations();

  const productInfo = `
## Vision XIX Labs & VisaNova
- Vision XIX Labs is the parent company (visionxixlabs.com).
- VisaNova (visanova.app) is our product for USCIS case tracking and immigration timelines.
- VisaNova helps users: track USCIS cases, see processing times, estimate timelines, understand queue position, get expedite guidance, prepare for interviews.
- Key tools: Processing Times (/processing-times), Status Decoder (/status-decoder), Fee Calculator (/fees), Official Links (/official-links).
- Help Center: /help — Interview Prep, Documents & Sponsors, Country Guidance, FAQs, Timelines, Example Forms, Tools Hub.
- Support: support@visionxixlabs.com — account, billing, or complex issues.
`;

  const immigrationBasics = `
## Common Immigration Forms & Stages
- I-130: Petition for Alien Relative (family-based green card). Consular or AOS.
- I-129F: Petition for Alien Fiancé(e) (K-1 visa). USCIS → DOS → Embassy.
- I-485: Application to Register Permanent Residence (Adjustment of Status, AOS).
- I-751: Petition to Remove Conditions on Residence (after 2-year green card).
- N-400: Application for Naturalization.
- Stages: USCIS → NVC → Embassy/Consulate (consular) OR AOS (if in US).
- NOA1 = Receipt notice. NOA2 = Approval notice.
`;

  const statusDecoder = `
## USCIS Case Status Explanations (use for "what does my status mean" questions)
${statusContent}
`;

  const receiptAndTracking = `
## USCIS Receipt Numbers & Tracking
- Receipt numbers: 3 letters + 10 digits (e.g. IOE1234567890, WAC1234567890).
- IOE = filed online. WAC = California, LIN = Nebraska, SRC = Texas, EAC = Vermont, MSC = National Benefits Center.
- Check status: egov.uscis.gov/casestatus — use receipt number.
- CEAC (travel.state.gov/CEAC) for NVC/embassy cases.
`;

  const expediteCriteria = `
## Expedite Request Criteria (USCIS)
Expedite may be granted for: severe financial loss; emergency/humanitarian; nonprofit in furtherance of US cultural/social interests; US government interest; clear USCIS error; compelling interest of USCIS.
- Must demonstrate urgent need. Evidence required.
- Not guaranteed. Processing times still apply if expedite denied.
- Call USCIS or request via Emma/contact form. Include receipt number and reason.
`;

  const interviewTips = `
## Interview Preparation (brief)
- Bring originals and copies of all submitted documents.
- Answer honestly and consistently with your application.
- Practice common questions: relationship history, employment, intent, background.
- Dress professionally. Arrive early. Be calm and respectful.
`;

  return `# Vision XIX Labs AI Knowledge Base
Use this content to answer user questions. Prefer verified information from this knowledge base.
${productInfo}
${immigrationBasics}
${receiptAndTracking}
${expediteCriteria}
${interviewTips}
${statusDecoder}

## Verified FAQ Content (VisaNova Help Center)
${faqContent || "(No FAQ content — answer from general immigration knowledge.)"}

## Instructions
- Be helpful, clear, and concise. Use markdown (bold, lists, links) when it improves readability.
- Identify as the Vision XIX Labs AI Assistant.
- For legal advice, recommend an immigration attorney.
- For account/billing, direct to support@visionxixlabs.com.
- When relevant, suggest VisaNova tools: /processing-times, /status-decoder, /fees, /help.`;
}
