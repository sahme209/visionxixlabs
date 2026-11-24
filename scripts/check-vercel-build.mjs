import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildDocsCorpus } from "./support/build-docs-corpus.mjs";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const nextConfig = readFileSync(join(projectRoot, "next.config.ts"), "utf8");
const nextTsConfig = JSON.parse(readFileSync(join(projectRoot, "tsconfig.next.json"), "utf8"));
const buildCommand = packageJson.scripts?.build ?? "";

if (/\bprisma\s+migrate\b/.test(buildCommand)) {
  throw new Error(
    "The application build must not mutate database migration state. Run npm run db:migrate:deploy explicitly.",
  );
}

if (nextConfig.includes("ignoreBuildErrors")) {
  throw new Error("Production builds must enforce Next.js TypeScript validation.");
}

if (!nextConfig.includes('tsconfigPath: "tsconfig.next.json"')) {
  throw new Error("Next.js must use the production-web TypeScript boundary.");
}

const requiredTypeExcludes = ["desktop", "**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "docs/recovery/**"];
const missingTypeExcludes = requiredTypeExcludes.filter(
  (pattern) => !(nextTsConfig.exclude ?? []).includes(pattern),
);
if (missingTypeExcludes.length > 0) {
  throw new Error(`tsconfig.next.json is missing build-only exclusions: ${missingTypeExcludes.join(", ")}`);
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

// This is a read-only freshness check, never automatic content generation.
let guideIndex;
let headingIndexCurrent = false;
try {
  const require = createRequire(import.meta.url);
  guideIndex = require("./generate-docs-heading-index.cjs").build();
  const expected = JSON.stringify(guideIndex, null, 2) + "\n";
  headingIndexCurrent = readFileSync(join(projectRoot, "lib/docs/guide-heading-index.json"), "utf8") === expected;
} catch {
  // Missing, malformed or unavailable source/index data must stop the build.
}
if (!headingIndexCurrent) {
  throw new Error("Public guide heading index is missing or stale. Run node scripts/generate-docs-heading-index.cjs and review the resulting source-bound index before building.");
}

let corpusCurrent = false;
try {
  const expected = JSON.stringify(buildDocsCorpus(guideIndex.guides), null, 1) + "\n";
  corpusCurrent = readFileSync(join(projectRoot, "lib/support/docsCorpus.json"), "utf8") === expected;
} catch {
  // The support index must come from the same reviewed public routes and bytes.
}
if (!corpusCurrent) {
  throw new Error("Public support corpus is missing or stale. Run node scripts/support/build-docs-corpus.mjs and review the resulting source-bound corpus before building.");
}

console.log(
  `Vercel build contract verified: web/desktop type boundaries explicit, type checks enforced, proxy convention current, no migration side effects, and ${cloudSdkPackages.length} cloud SDK packages externalized.`,
);
