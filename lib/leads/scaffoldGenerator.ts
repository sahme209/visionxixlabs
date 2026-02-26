/**
 * Website scaffold generator: Next.js + Tailwind static site.
 * Uses AI Starter Package to generate Home, About, Services, Contact pages.
 * Stores output in data/scaffolds/{leadId}/
 */

import fs from "fs";
import path from "path";
import archiver from "archiver";
import type { AiStarterPackage } from "@/lib/websiteStarter/engine";

const SCAFFOLDS_DIR = path.join(process.cwd(), "data", "scaffolds");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFile(filePath: string, content: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
}

export async function generateScaffold(leadId: string, pkg: AiStarterPackage): Promise<string> {
  const baseDir = path.join(SCAFFOLDS_DIR, leadId);
  ensureDir(baseDir);

  const businessName = "Your Business";

  const layout = `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "${businessName}",
  description: "${pkg.seoStarter?.metaDescription || "Professional website"}",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <nav className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 flex justify-between">
            <a href="/" className="font-semibold text-slate-900">${businessName}</a>
            <div className="flex gap-6">
              <a href="/" className="text-slate-600 hover:text-slate-900">Home</a>
              <a href="/about" className="text-slate-600 hover:text-slate-900">About</a>
              <a href="/services" className="text-slate-600 hover:text-slate-900">Services</a>
              <a href="/contact" className="text-slate-600 hover:text-slate-900">Contact</a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
          © ${new Date().getFullYear()} ${businessName}
        </footer>
      </body>
    </html>
  );
}
`;

  const homePage = `export default function Home() {
  return (
    <div>
      <section className="py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
          ${(pkg.heroHeadline || "Welcome").replace(/"/g, '\\"')}
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl">
          ${(pkg.heroSubheadline || "Your tagline here.").replace(/"/g, '\\"')}
        </p>
        <a
          href="/contact"
          className="inline-block mt-6 px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800"
        >
          Get in Touch
        </a>
      </section>
      <section className="py-12">
        <p className="text-slate-600 leading-relaxed">
          ${(pkg.draftCopy?.home || "Home page content.").replace(/"/g, '\\"').replace(/\n/g, " ")}
        </p>
      </section>
    </div>
  );
}
`;

  const aboutPage = `export default function About() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-6">About</h1>
      <p className="text-slate-600 leading-relaxed">
        ${(pkg.draftCopy?.about || "About page content.").replace(/"/g, '\\"').replace(/\n/g, " ")}
      </p>
    </div>
  );
}
`;

  const servicesPage = `export default function Services() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Services</h1>
      <p className="text-slate-600 leading-relaxed">
        ${(pkg.draftCopy?.services || "Services page content.").replace(/"/g, '\\"').replace(/\n/g, " ")}
      </p>
    </div>
  );
}
`;

  const contactPage = `export default function Contact() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Contact</h1>
      <p className="text-slate-600 mb-8">
        ${(pkg.draftCopy?.contact || "Contact page content.").replace(/"/g, '\\"').replace(/\n/g, " ")}
      </p>
      <form className="max-w-md space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            id="name"
            type="text"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-slate-500"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            id="email"
            type="email"
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-slate-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">Message</label>
          <textarea
            id="message"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-slate-500"
            placeholder="Your message"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800"
        >
          Send
        </button>
      </form>
    </div>
  );
}
`;

  const packageJson = `{
  "name": "website-scaffold",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10",
    "postcss": "^8",
    "tailwindcss": "^3.4.0",
    "typescript": "^5"
  }
}
`;

  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`;

  const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  const tsconfig = `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;

  writeFile(path.join(baseDir, "app", "layout.tsx"), layout);
  writeFile(path.join(baseDir, "app", "page.tsx"), homePage);
  writeFile(path.join(baseDir, "app", "about", "page.tsx"), aboutPage);
  writeFile(path.join(baseDir, "app", "services", "page.tsx"), servicesPage);
  writeFile(path.join(baseDir, "app", "contact", "page.tsx"), contactPage);
  writeFile(path.join(baseDir, "package.json"), packageJson);
  writeFile(path.join(baseDir, "tailwind.config.js"), tailwindConfig);
  writeFile(path.join(baseDir, "postcss.config.js"), postcssConfig);
  writeFile(path.join(baseDir, "tsconfig.json"), tsconfig);
  writeFile(path.join(baseDir, "next.config.js"), `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;\n`);
  writeFile(path.join(baseDir, "app", "globals.css"), `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`);

  const zipPath = path.join(SCAFFOLDS_DIR, `${leadId}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  return new Promise<string>((resolve, reject) => {
    output.on("close", () => resolve(zipPath));
    archive.on("error", reject);
    archive.pipe(output);

    archive.directory(baseDir, false);
    archive.finalize();
  });
}

export function getScaffoldZipPath(leadId: string): string | null {
  const zipPath = path.join(SCAFFOLDS_DIR, `${leadId}.zip`);
  if (fs.existsSync(zipPath)) return zipPath;
  return null;
}
