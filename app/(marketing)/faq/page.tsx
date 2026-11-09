import { permanentRedirect } from "next/navigation";

/** One FAQ: /docs/faq (shared with the Ask Axiom support agent). Logic audit 2026-11-09. */
export default function FaqPage() {
  permanentRedirect("/docs/faq");
}
