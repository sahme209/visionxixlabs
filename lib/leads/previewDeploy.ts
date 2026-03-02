/**
 * Preview deployment: generates static HTML from AI Starter Package and deploys to Vercel.
 * Uses Vercel Deployments API. Env: VERCEL_TOKEN, VERCEL_TEAM_ID (optional).
 */

import type { AiStarterPackage } from "./aiWebsiteStarter";

export interface DeployResult {
  url: string;
  deploymentId: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function generateStaticFiles(
  pkg: AiStarterPackage,
  businessName: string
): Record<string, string> {
  const brand = businessName || "Your Business";
  const pages = pkg.siteStructure.pages;
  const navItems = pages.map((p) => {
    const slug = p.name.toLowerCase().replace(/\s+/g, "-");
    const file = slug === "home" ? "index" : slug;
    return { label: p.name, href: file === "index" ? "/" : `/${file}.html` };
  });

  const baseCss = `
:root { --primary: #0071e3; --text: #1d1d1f; --text-muted: #6b7280; --bg: #fff; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: var(--text); background: var(--bg); }
nav { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 1rem 2rem; }
nav a { margin-right: 1.5rem; color: var(--primary); text-decoration: none; }
nav a:hover { text-decoration: underline; }
main { max-width: 720px; margin: 0 auto; padding: 3rem 2rem; }
h1 { font-size: 2rem; margin-bottom: 1rem; }
h2 { font-size: 1.25rem; margin: 2rem 0 0.5rem; color: var(--text-muted); }
p { margin-bottom: 1rem; }
.cta { display: inline-block; background: var(--primary); color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; margin-top: 1rem; }
.cta:hover { opacity: 0.9; }
footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid #e2e8f0; font-size: 0.875rem; color: var(--text-muted); }
`;

  const makePage = (title: string, content: string, slug: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} — ${escapeHtml(brand)}</title>
<meta name="description" content="${escapeHtml(pkg.seoStarter.metaDescription)}">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<nav>
${navItems.map((n) => `  <a href="${n.href}">${escapeHtml(n.label)}</a>`).join("\n")}
</nav>
<main>
${content}
</main>
<footer>Draft preview for planning. Final content refined during build.</footer>
</body>
</html>`;

  const heroContent = `
  <h1>${escapeHtml(pkg.heroHeadline)}</h1>
  <p>${escapeHtml(pkg.heroSubheadline)}</p>
  <p>${escapeHtml(pkg.draftCopy.home)}</p>
  ${pkg.ctaRecommendations.filter((c) => c.placement === "hero").length > 0 ? `<a class="cta" href="/contact.html">${escapeHtml(pkg.ctaRecommendations.find((c) => c.placement === "hero")?.label || "Get Started")}</a>` : ""}
`;

  const getCopy = (pageName: string): string => {
    const n = pageName.toLowerCase();
    if (n.includes("about")) return pkg.draftCopy.about;
    if (n.includes("service")) return pkg.draftCopy.services;
    if (n.includes("contact")) return pkg.draftCopy.contact;
    return pkg.draftCopy.home;
  };

  const files: Record<string, string> = {
    "style.css": baseCss.trim(),
  };

  // Index (Home)
  files["index.html"] = makePage("Home", heroContent, "home");

  // Other pages
  for (const page of pages) {
    if (page.name.toLowerCase() === "home") continue;
    const slug = page.name.toLowerCase().replace(/\s+/g, "-");
    const copy = getCopy(page.name);
    const content = `
  <h1>${escapeHtml(page.name)}</h1>
  <p>${escapeHtml(copy)}</p>
`;
    files[`${slug}.html`] = makePage(page.name, content, slug);
  }

  return files;
}

export async function deployPreview(
  leadId: string,
  pkg: AiStarterPackage,
  businessName: string,
  target: "preview" | "production" = "preview"
): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) throw new Error("VERCEL_TOKEN not set");

  const files = generateStaticFiles(pkg, businessName);
  const projectName = `preview-${leadId.slice(0, 12)}`;

  const vercelFiles = Object.entries(files).map(([file, data]) => ({
    file,
    data,
    encoding: "utf-8" as const,
  }));

  const body = {
    name: projectName,
    files: vercelFiles,
    target: target === "production" ? "production" : undefined,
    projectSettings: { framework: null },
  };

  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const url = new URL("https://api.vercel.com/v13/deployments");
  if (teamId) url.searchParams.set("teamId", teamId);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel deploy failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { url?: string; id?: string };
  const deploymentUrl = data.url;
  const deploymentId = data.id;

  if (!deploymentUrl) throw new Error("Vercel returned no deployment URL");

  return {
    url: deploymentUrl.startsWith("https://") ? deploymentUrl : `https://${deploymentUrl}`,
    deploymentId: String(deploymentId ?? ""),
  };
}
