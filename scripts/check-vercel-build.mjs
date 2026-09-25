import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const nextConfig = readFileSync(join(projectRoot, "next.config.ts"), "utf8");
const buildCommand = packageJson.scripts?.build ?? "";

if (/\bprisma\s+migrate\b/.test(buildCommand)) {
  throw new Error(
    "The application build must not mutate database migration state. Run npm run db:migrate:deploy explicitly.",
  );
}

if (nextConfig.includes("ignoreBuildErrors")) {
  throw new Error("Production builds must enforce Next.js TypeScript validation.");
}

if (!existsSync(join(projectRoot, "proxy.ts")) || existsSync(join(projectRoot, "middleware.ts"))) {
  throw new Error("Next.js 16 routing must use proxy.ts, not the deprecated middleware.ts convention.");
}

const cloudSdkPackages = Object.keys(packageJson.dependencies ?? {}).filter((name) =>
  /^@(aws-sdk|azure|google-cloud)\//.test(name),
);
const missingExternals = cloudSdkPackages.filter(
  (packageName) => !nextConfig.includes(`"${packageName}"`),
);

if (missingExternals.length > 0) {
  throw new Error(
    `Node-only cloud SDKs must be listed in serverExternalPackages: ${missingExternals.join(", ")}`,
  );
}

console.log(
  `Vercel build contract verified: type checks enforced, proxy convention current, no migration side effects, and ${cloudSdkPackages.length} cloud SDK packages externalized.`,
);
