import { readFileSync } from "node:fs";
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
  `Vercel build contract verified: no migration side effects; ${cloudSdkPackages.length} cloud SDK packages externalized.`,
);
