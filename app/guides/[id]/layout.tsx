import type { Metadata } from "next";
import { guides } from "@/lib/guides-data";
import { SITE_NAME } from "@/lib/seo";

function cleanTitle(title: string): string {
  return title.replace(/📝\s*|💍\s*|🟢\s*|💑\s*|💼\s*|✈️\s*|🏢\s*|💚\s*|🆔\s*|🇺🇸\s*|📋\s*|🛡️\s*|🔐\s*|🎓\s*/g, "").trim();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const guide = guides.find((g) => g.id === id);
  if (!guide) {
    return { title: "Form Guide | VisaNova" };
  }
  const title = cleanTitle(guide.title);
  const overview = guide.overview ?? "";
  const description =
    overview.slice(0, 155) + (overview.length > 155 ? "…" : "");
  const formMatch = title.match(/\b(I|N|K)[-\s]?\d+[A-Za-z]?\b/);
  const formName = formMatch ? formMatch[0].replace(/\s/g, "-") : title;
  return {
    title: `${formName} Guide — How to File & Track`,
    description: description,
    keywords: [
      formName,
      "USCIS form",
      "how to file",
      "processing time",
      guide.estimatedTime ?? "processing time",
      "step by step",
    ],
    openGraph: {
      title: `${formName} Guide | ${SITE_NAME}`,
      description: description,
      url: `https://visanova.app/guides/${id}`,
    },
  };
}

export default function GuideIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
