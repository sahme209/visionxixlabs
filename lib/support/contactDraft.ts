import { containsSupportSecret } from "./secretQuestion";

export const SUPPORT_CONTACT_HREF = "/contact?topic=ask-axiom";

let pendingDraft: { question: string; expiresAt: number } | undefined;

export function stageSupportContactDraft(input: string) {
  pendingDraft = undefined;
  if (containsSupportSecret(input)) return;
  const question = input.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500);
  if (question) pendingDraft = { question, expiresAt: Date.now() + 60_000 };
}

export function takeSupportContactDraft() {
  const draft = pendingDraft;
  pendingDraft = undefined;
  if (draft && draft.expiresAt > Date.now()) return draft.question;
}
