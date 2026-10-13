type Confirmation = {
  email: string;
  displayName: string | null;
  amountCents: number;
  badgeUrl: string;
  referenceId: string;
};

async function send(payload: object): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.ok;
}

function sender(): string {
  const configured = process.env.RESEND_FROM_EMAIL;
  return configured ? `Vision XIX Labs <${configured}>` : "onboarding@resend.dev";
}

export async function sendSupporterConfirmation(input: Confirmation): Promise<boolean> {
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(input.amountCents / 100);
  return send({
    from: sender(),
    to: [input.email],
    subject: "Your Vision XIX Labs Founding Supporter confirmation",
    text: [
      `Thank you${input.displayName ? `, ${input.displayName}` : ""}, for supporting Axiom Agent's development.`,
      "",
      `One-time purchase: ${amount}`,
      `Reference: ${input.referenceId}`,
      `Digital badge: ${input.badgeUrl}`,
      "",
      "This purchase supports Vision XIX Labs LLC, a for-profit technology company. It is not a charitable donation, is not tax-deductible as a charitable contribution, and does not provide equity or a financial return.",
      "",
      "Support and refund questions: support@visionxixlabs.com",
    ].join("\n"),
  });
}

export async function sendSponsorshipNotification(input: { name: string; email: string; organization: string; range: string; message: string; referenceId: string }): Promise<boolean> {
  const target = process.env.CONTACT_EMAIL || "support@visionxixlabs.com";
  return send({
    from: sender(),
    to: [target],
    reply_to: input.email,
    subject: `Founding Supporter sponsorship inquiry · ${input.organization || input.name}`.slice(0, 255),
    text: `Name: ${input.name}\nEmail: ${input.email}\nOrganization: ${input.organization || "Not provided"}\nRange: ${input.range}\nReference: ${input.referenceId}\n\n${input.message}`,
  });
}
