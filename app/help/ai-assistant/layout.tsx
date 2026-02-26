import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vision XIX Labs AI Assistant — USCIS & Immigration Help",
  description:
    "Ask the Vision XIX Labs AI assistant about USCIS case tracking, I-130/I-129F processing times, expedite options, and immigration questions. Powered by Vision XIX Labs.",
  openGraph: {
    title: "Vision XIX Labs AI | VisaNova",
    description: "Your AI assistant for USCIS and immigration questions.",
    url: "https://visanova.app/help/ai-assistant",
  },
};

export default function AIAssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
