/**
 * Static HTML generator for website preview.
 * Produces deployable HTML files from AiStarterPackage (no code shown to customer).
 */

import type { AiStarterPackage } from "./aiWebsiteStarter";

const NAV = (bn: string) => `
<nav style="border-bottom:1px solid #e2e8f0;background:#fff;padding:1rem 1.5rem;">
  <div style="max-width:72rem;margin:0 auto;display:flex;justify-content:space-between;align-items:center;">
    <a href="/" style="font-weight:600;color:#0f172a;text-decoration:none;">${bn}</a>
    <div style="display:flex;gap:1.5rem;">
      <a href="/" style="color:#64748b;text-decoration:none;">Home</a>
      <a href="/about.html" style="color:#64748b;text-decoration:none;">About</a>
      <a href="/services.html" style="color:#64748b;text-decoration:none;">Services</a>
      <a href="/contact.html" style="color:#64748b;text-decoration:none;">Contact</a>
    </div>
  </div>
</nav>`;

const FOOTER = (bn: string) => `
<footer style="border-top:1px solid #e2e8f0;padding:2rem;text-align:center;font-size:0.875rem;color:#64748b;">
  © ${new Date().getFullYear()} ${bn}
</footer>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generatePreviewHtmlFiles(
  pkg: AiStarterPackage,
  businessName: string
): Array<{ file: string; data: string }> {
  const bn = escapeHtml(businessName || "Your Business");
  const metaDesc = escapeHtml(pkg.seoStarter?.metaDescription || "Professional website");
  const metaTitle = escapeHtml(pkg.seoStarter?.metaTitle || bn);

  const head = (title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${metaDesc}">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#0f172a;line-height:1.6;}
    main{max-width:72rem;margin:0 auto;padding:3rem 1.5rem;}
    h1{font-size:1.875rem;margin-bottom:1rem;}
    h2{font-size:1.5rem;margin-bottom:0.75rem;}
    p{color:#475569;margin-bottom:1rem;}
    a.btn{display:inline-block;margin-top:1rem;padding:0.75rem 1.5rem;background:#0f172a;color:#fff;text-decoration:none;font-weight:500;border-radius:0.5rem;}
    a.btn:hover{background:#334155;}
    input,textarea{width:100%;padding:0.5rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.375rem;margin-bottom:0.75rem;}
    button{padding:0.5rem 1rem;background:#0f172a;color:#fff;border:none;border-radius:0.375rem;cursor:pointer;}
  </style>
</head>
<body>`;

  const indexHtml = `${head(metaTitle)}
${NAV(bn)}
<main>
  <section style="padding:4rem 0;">
    <h1>${escapeHtml(pkg.heroHeadline || "Welcome")}</h1>
    <p style="font-size:1.125rem;color:#64748b;max-width:42rem;">${escapeHtml(pkg.heroSubheadline || "Your tagline here.")}</p>
    <a href="/contact.html" class="btn">Get in Touch</a>
  </section>
  <section style="padding:2rem 0;">
    <p>${escapeHtml(pkg.draftCopy?.home || "Home page content.").replace(/\n/g, "<br>")}</p>
  </section>
</main>
${FOOTER(bn)}
</body>
</html>`;

  const aboutHtml = `${head(`${bn} | About`)}
${NAV(bn)}
<main>
  <h1>About</h1>
  <p>${escapeHtml(pkg.draftCopy?.about || "About page content.").replace(/\n/g, "<br>")}</p>
</main>
${FOOTER(bn)}
</body>
</html>`;

  const servicesHtml = `${head(`${bn} | Services`)}
${NAV(bn)}
<main>
  <h1>Services</h1>
  <p>${escapeHtml(pkg.draftCopy?.services || "Services page content.").replace(/\n/g, "<br>")}</p>
</main>
${FOOTER(bn)}
</body>
</html>`;

  const contactHtml = `${head(`${bn} | Contact`)}
${NAV(bn)}
<main>
  <h1>Contact</h1>
  <p>${escapeHtml(pkg.draftCopy?.contact || "Contact page content.").replace(/\n/g, "<br>")}</p>
  <form style="max-width:28rem;margin-top:2rem;" action="#" method="post">
    <input type="text" name="name" placeholder="Your name">
    <input type="email" name="email" placeholder="Email">
    <textarea name="message" rows="4" placeholder="Message"></textarea>
    <button type="submit">Send</button>
  </form>
</main>
${FOOTER(bn)}
</body>
</html>`;

  const vercelJson = JSON.stringify({
    cleanUrls: true,
    trailingSlash: false,
  });

  return [
    { file: "index.html", data: indexHtml },
    { file: "about.html", data: aboutHtml },
    { file: "services.html", data: servicesHtml },
    { file: "contact.html", data: contactHtml },
    { file: "vercel.json", data: vercelJson },
  ];
}
