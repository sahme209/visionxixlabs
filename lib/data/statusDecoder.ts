/**
 * Case status decoder — plain-language explanations for immigration case statuses.
 */

export interface StatusExplanation {
  summary: string;
  whatItMeans: string;
  typicalNext: string;
  tip?: string;
}

export const statusExplanations: Record<string, StatusExplanation> = {
  "case was received": {
    summary: "Your application has been received.",
    whatItMeans: "The agency has your case in their system. It’s in line for review.",
    typicalNext: "Initial review, then biometrics appointment (if required) or further processing.",
    tip: "Keep your receipt number safe. Use it to check status.",
  },
  "case was received and a receipt notice was sent": {
    summary: "Your application was received and a receipt was sent.",
    whatItMeans: "Your case is logged. The notice you received by mail or email confirms it.",
    typicalNext: "Biometrics appointment notice, or direct processing for some forms.",
    tip: "Check the notice for your receipt number and next steps.",
  },
  "fingerprint fee was received": {
    summary: "Biometrics fee was accepted.",
    whatItMeans: "The fee for fingerprinting and background checks has been processed.",
    typicalNext: "You’ll get a biometrics appointment notice.",
    tip: "Attend the appointment on the scheduled date. Bring a valid ID.",
  },
  "case is being actively reviewed": {
    summary: "Your case is under review.",
    whatItMeans: "An officer is reviewing your file. No further action from you unless they request it.",
    typicalNext: "Approval, Request for Evidence (RFE), or interview notice.",
    tip: "This can last weeks or months. No need to contact them during this time.",
  },
  "request for initial evidence was sent": {
    summary: "More information was requested.",
    whatItMeans: "The agency needs additional documents or answers. Check your mail and online account.",
    typicalNext: "Submit the requested evidence by the deadline on the notice.",
    tip: "Reply before the deadline. Missing it can lead to denial.",
  },
  "request for additional evidence was sent": {
    summary: "Additional documents or information requested.",
    whatItMeans: "Same as above—they need more from you. The notice will list exactly what.",
    typicalNext: "Gather the requested items and send them before the deadline.",
    tip: "Read the notice carefully and send exactly what they ask for.",
  },
  "response to uscis request for evidence was received": {
    summary: "Your response to their request was received.",
    whatItMeans: "They’ve received what you sent. An officer will review it.",
    typicalNext: "Further review, then approval or another request.",
    tip: "Expect a few weeks for them to process your response.",
  },
  "response to request for evidence was received": {
    summary: "Your response to their request was received.",
    whatItMeans: "They’ve received what you sent. An officer will review it.",
    typicalNext: "Further review, then approval or another request.",
    tip: "Expect a few weeks for them to process your response.",
  },
  "interview was scheduled": {
    summary: "An interview has been scheduled.",
    whatItMeans: "You’ll receive a notice with the date, time, and location of your interview.",
    typicalNext: "Attend the interview. Bring the documents listed on the notice.",
    tip: "Practice common questions and bring originals of key documents.",
  },
  "interview was completed and my case must be reviewed": {
    summary: "Interview done; case under review.",
    whatItMeans: "The interview is over. They’re reviewing your case before a decision.",
    typicalNext: "Approval, denial, or sometimes a request for more evidence.",
    tip: "Decisions often come within a few weeks to a few months.",
  },
  "case was approved": {
    summary: "Your case was approved.",
    whatItMeans: "You’ve been approved for the benefit you applied for.",
    typicalNext: "You’ll receive an approval notice and/or your card/document by mail.",
    tip: "Keep copies of the approval notice for your records.",
  },
  "card was delivered": {
    summary: "Your card was delivered.",
    whatItMeans: "Your physical card (e.g., green card, EAD) was sent and delivered.",
    typicalNext: "You’re done with this step. Check the card for accuracy.",
    tip: "Report any errors on the card right away.",
  },
  "card was picked up by the united states postal service": {
    summary: "Your card is in the mail.",
    whatItMeans: "Your card was mailed. Track it using the tracking number in your account.",
    typicalNext: "Delivery within a few days.",
    tip: "Ensure your mailing address is correct. Sign for delivery if required.",
  },
  "card is being produced": {
    summary: "Your card is being produced.",
    whatItMeans: "Your physical card is being printed and prepared.",
    typicalNext: "Card will be mailed within a few weeks.",
    tip: "No action needed. You’ll get a tracking number when it ships.",
  },
  "decision notice mailed": {
    summary: "A decision notice was mailed.",
    whatItMeans: "A letter with the decision (approval or denial) has been sent.",
    typicalNext: "Receive the notice by mail. Follow any instructions in it.",
    tip: "If denied, the notice will explain appeal options and deadlines.",
  },
  "case was denied": {
    summary: "Your case was denied.",
    whatItMeans: "Your application was not approved. The denial notice explains why.",
    typicalNext: "Read the notice. You may be able to appeal or reapply, depending on the form.",
    tip: "Consult an immigration attorney before appealing or reapplying.",
  },
  "case was transferred": {
    summary: "Your case was transferred.",
    whatItMeans: "Your case was moved to another office for processing. This is common.",
    typicalNext: "Processing continues at the new office. Check for updates periodically.",
    tip: "You may receive a transfer notice. Your receipt number stays the same.",
  },
  "we sent a request for additional evidence": {
    summary: "More information was requested.",
    whatItMeans: "The agency needs additional documents or clarification.",
    typicalNext: "Respond by the deadline on the notice with exactly what they ask for.",
    tip: "Use certified mail or trackable delivery for your response.",
  },
};

/** Popular statuses for quick-click chips */
export const popularStatuses = [
  "Case Was Received and a Receipt Notice Was Sent",
  "Case Is Being Actively Reviewed",
  "Request for Initial Evidence Was Sent",
  "Response to USCIS' Request for Evidence Was Received",
  "Interview Was Scheduled",
  "Case Was Approved",
  "Card Is Being Produced",
  "Card Was Delivered",
  "Interview Was Completed And My Case Must Be Reviewed",
  "Case Was Denied",
  "Case Was Transferred",
];

export function findExplanation(statusText: string): StatusExplanation | null {
  const normalized = statusText.trim().toLowerCase();
  for (const [key, explanation] of Object.entries(statusExplanations)) {
    if (normalized.includes(key)) return explanation;
  }
  return null;
}
