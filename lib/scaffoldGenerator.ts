import type { AIStarterPackage } from "@/lib/websiteStarter/engine";

export type GeneratedFile = { path: string; content: string };

/** Website plan from /api/website-builder/plan (Base44-style full build) */
export type WebsiteBuilderPlan = {
  siteName: string;
  fullPageHtml?: string;
  heroHtml?: string;
  designLanguage?: string;
  colorPalette?: { primary: string; secondary: string; accent: string };
  sections?: Array<{ id: string; name: string; description: string }>;
};

/**
 * Generate deployable files from website-builder plan (full HTML).
 * Used when user builds from /website-builder with fullPageHtml.
 */
export function generateSiteFilesFromPlan(plan: WebsiteBuilderPlan): GeneratedFile[] {
  let html = plan.fullPageHtml || plan.heroHtml || "";
  if (!html.trim()) return [];

  html = html.replace(/```html?\s*/gi, "").replace(/```\s*/g, "").trim();
  if (!html.startsWith("<")) return [];

  const siteName = plan.siteName || "Your Site";
  const metaDesc = plan.designLanguage || "Professional website built with Vision XIX AI.";

  if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
    html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(siteName)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">
</head>
<body>${html}</body>
</html>`;
  }

  return [{ path: "index.html", content: html }];
}

/**
 * Generate static site files (3-5 pages) from AI starter package.
 * Output: index.html, about.html, services.html, contact.html, faq.html (optional)
 */
export function generateSiteFiles(pkg: AIStarterPackage): GeneratedFile[] {
  const baseCss = getBaseCss();
  const navItems = [
    { label: "Home", href: "index.html" },
    { label: "About", href: "about.html" },
    { label: "Services", href: "services.html" },
    { label: "Contact", href: "contact.html" },
  ];
  if (pkg.faqItems && pkg.faqItems.length > 0) {
    navItems.push({ label: "FAQ", href: "faq.html" });
  }

  const files: GeneratedFile[] = [];

  const heroHeadline = pkg.homepageHero || pkg.companyName;
  const metaTitle = pkg.metaTitle || `${pkg.companyName} | ${pkg.tagline}`;
  const metaDesc = pkg.metaDescription || pkg.tagline;

  files.push({
    path: "index.html",
    content: wrapPage(
      pkg.companyName,
      baseCss,
      navItems,
      "Home",
      metaTitle,
      metaDesc,
      `
      <header class="hero">
        <h1>${escapeHtml(heroHeadline)}</h1>
        <p class="tagline">${escapeHtml(pkg.tagline)}</p>
      </header>
      <section>
        <h2>Welcome</h2>
        <p>${escapeHtml(pkg.aboutText.slice(0, 300))}${pkg.aboutText.length > 300 ? "…" : ""}</p>
        <p><a href="about.html">Learn more about us →</a></p>
      </section>
      <section>
        <h2>Our Services</h2>
        <ul class="services-list">
          ${pkg.services.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
        <p><a href="services.html">View all services →</a></p>
      </section>
      `
    ),
  });

  files.push({
    path: "about.html",
    content: wrapPage(
      pkg.companyName,
      baseCss,
      navItems,
      "About",
      metaTitle,
      metaDesc,
      `
      <header>
        <h1>About Us</h1>
      </header>
      <section>
        <p>${escapeHtml(pkg.aboutText)}</p>
      </section>
      `
    ),
  });

  files.push({
    path: "services.html",
    content: wrapPage(
      pkg.companyName,
      baseCss,
      navItems,
      "Services",
      metaTitle,
      metaDesc,
      `
      <header>
        <h1>Our Services</h1>
      </header>
      <section>
        <ul class="services-list">
          ${pkg.services.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
      </section>
      `
    ),
  });

  files.push({
    path: "contact.html",
    content: wrapPage(
      pkg.companyName,
      baseCss,
      navItems,
      "Contact",
      metaTitle,
      metaDesc,
      `
      <header>
        <h1>Contact Us</h1>
      </header>
      <section>
        <p>Reach out to us:</p>
        <ul>
          <li>Email: <a href="mailto:${escapeHtml(pkg.contactEmail)}">${escapeHtml(pkg.contactEmail)}</a></li>
          ${pkg.contactPhone ? `<li>Phone: ${escapeHtml(pkg.contactPhone)}</li>` : ""}
        </ul>
      </section>
      `
    ),
  });

  if (pkg.faqItems && pkg.faqItems.length > 0) {
    files.push({
      path: "faq.html",
      content: wrapPage(
        pkg.companyName,
        baseCss,
        navItems,
        "FAQ",
        metaTitle,
        metaDesc,
        `
        <header>
          <h1>Frequently Asked Questions</h1>
        </header>
        <section>
          <dl class="faq">
            ${pkg.faqItems.map((f) => `
              <dt>${escapeHtml(f.q)}</dt>
              <dd>${escapeHtml(f.a)}</dd>
            `).join("")}
          </dl>
        </section>
        `
      ),
    });
  }

  return files;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getBaseCss(): string {
  return `
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
    nav { margin-bottom: 32px; }
    nav a { margin-right: 16px; color: #4f46e5; text-decoration: none; }
    nav a:hover { text-decoration: underline; }
    .hero { text-align: center; padding: 48px 0; }
    .hero h1 { font-size: 2rem; margin: 0 0 8px; }
    .tagline { font-size: 1.125rem; color: #64748b; margin: 0; }
    h2 { font-size: 1.25rem; margin-top: 32px; }
    .services-list { list-style: none; padding: 0; }
    .services-list li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .faq dt { font-weight: 600; margin-top: 16px; }
    .faq dd { margin: 4px 0 0 16px; color: #475569; }
  `;
}

function wrapPage(
  title: string,
  css: string,
  navItems: { label: string; href: string }[],
  pageTitle: string,
  metaTitle: string,
  metaDesc: string,
  body: string
): string {
  const nav = navItems
    .map((n) => `<a href="${escapeHtml(n.href)}">${escapeHtml(n.label)}</a>`)
    .join("");
  const fullTitle = pageTitle === "Home" ? metaTitle : `${pageTitle} | ${title}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDesc)}">
  <style>${css}</style>
</head>
<body>
  <div class="wrap">
    <nav>${nav}</nav>
    ${body}
  </div>
</body>
</html>`;
}
