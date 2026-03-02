/**
 * Generates a Next.js + Tailwind scaffold from AI Starter Package.
 * Disabled on Vercel (VERCEL=1) and in production (NODE_ENV=production).
 * Used for internal scaffold download only; not for preview deployment.
 */

import type { AiStarterPackage } from "./aiWebsiteStarter";
import * as fs from "fs";
import * as path from "path";

const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

export function canGenerateScaffold(): boolean {
  return !isProd;
}

export async function generateScaffold(
  leadId: string,
  pkg: AiStarterPackage,
  businessName: string
): Promise<string> {
  if (isProd) throw new Error("Scaffold generation is disabled in production");
  const archiver = await import("archiver");
  const outputDir = path.join(process.cwd(), "data", "scaffolds", leadId);
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const pages = pkg.siteStructure.pages;
  const pageNames = pages.map((p) => p.name.toLowerCase().replace(/\s+/g, "-"));

  // package.json
  const pkgJson = {
    name: `website-${leadId.slice(0, 8)}`,
    version: "0.1.0",
    private: true,
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      next: "^14",
      react: "^18",
      "react-dom": "^18",
    },
  };
  fs.writeFileSync(
    path.join(outputDir, "package.json"),
    JSON.stringify(pkgJson, null, 2)
  );

  // app/layout.tsx
  const layoutTsx = `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
  fs.mkdirSync(path.join(outputDir, "app"), { recursive: true });
  fs.writeFileSync(path.join(outputDir, "app", "layout.tsx"), layoutTsx);

  // app/page.tsx (Home)
  const homeTsx = `export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 40 }}>
      <h1>${escapeHtml(pkg.heroHeadline)}</h1>
      <p>${escapeHtml(pkg.heroSubheadline)}</p>
      <p>${escapeHtml(pkg.draftCopy.home)}</p>
    </main>
  );
}
`;
  fs.writeFileSync(path.join(outputDir, "app", "page.tsx"), homeTsx);

  // Other pages
  for (let i = 1; i < pageNames.length; i++) {
    const name = pageNames[i];
    const page = pages[i];
    const dir = path.join(outputDir, "app", name);
    fs.mkdirSync(dir, { recursive: true });
    const copyKey = (page?.name?.toLowerCase() ?? name).replace(/\s+/g, "");
    const copyText =
      (pkg.draftCopy as Record<string, string>)[copyKey] ??
      (page?.name === "About"
        ? pkg.draftCopy.about
        : page?.name === "Services"
          ? pkg.draftCopy.services
          : page?.name === "Contact"
            ? pkg.draftCopy.contact
            : pkg.draftCopy.home);
    const pageTsx = `export default function ${toPascal(name)}() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 40 }}>
      <h1>${escapeHtml(page?.name ?? name)}</h1>
      <p>${escapeHtml(copyText)}</p>
    </main>
  );
}
`;
    fs.writeFileSync(path.join(dir, "page.tsx"), pageTsx);
  }

  const zipPath = path.join(process.cwd(), "data", "scaffolds", `scaffold-${leadId}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver.default("zip", { zlib: { level: 9 } });
  archive.pipe(output);
  archive.directory(outputDir, "website");
  await archive.finalize();
  await new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
  });

  return zipPath;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toPascal(s: string): string {
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}
