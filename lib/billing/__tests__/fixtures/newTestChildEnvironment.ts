import { dirname, isAbsolute, resolve } from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";

const passthrough = [
  "PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL",
  "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_USE_ENV_PROXY",
  "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_PROXY_CERT", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "AWS_CA_BUNDLE",
] as const;
const heapOnly = /^--max[-_]old[-_]space[-_]size=[1-9][0-9]*$/;
function unsupported(): never { throw new Error("owned_test_child_options_unsupported"); }
function trustedWarningPreload(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = realpathSync(require.resolve("vitest/package.json"));
    const installed = JSON.parse(readFileSync(pkg, "utf8")) as { version?: unknown };
    const lock = JSON.parse(readFileSync(new URL("../../../../package-lock.json", import.meta.url), "utf8")) as { packages?: Record<string, { version?: unknown }> };
    const preload = realpathSync(resolve(dirname(pkg), "suppress-warnings.cjs"));
    // Explicitly reviewed installed/locked framework code, not an arbitrary
    // caller-selected preload or a basename-based guard exception.
    if (installed.version !== "5.1.0" || lock.packages?.["node_modules/vitest"]?.version !== installed.version
      || createHash("sha256").update(readFileSync(preload)).digest("hex") !== "3f415a8b5d53b4262580a8fe99158722cfe0f1514a000a457d1379c96da90f9f") unsupported();
    return preload;
  } catch { return unsupported(); }
}
export function checkedChildEnvironment(inherited: Readonly<Record<string, string | undefined>>, execArgv: readonly string[]): NodeJS.ProcessEnv {
  if (["NODE_TLS_REJECT_UNAUTHORIZED", "OPENSSL_CONF"].some(key => Object.prototype.hasOwnProperty.call(inherited, key))) unsupported();
  const nodeOptions = inherited.NODE_OPTIONS;
  if (nodeOptions?.trim() && !heapOnly.test(nodeOptions.trim())) unsupported();
  const cliHeap: string[] = []; const framework: string[] = [];
  for (let i = 0; i < execArgv.length; i++) {
    const option = execArgv[i];
    if (heapOnly.test(option)) { cliHeap.push(option); continue; }
    if (option === "--experimental-import-meta-resolve") { framework.push(option); continue; }
    if (option === "--require") {
      const trusted = trustedWarningPreload();
      if (execArgv[i + 1] !== trusted) unsupported();
      framework.push("--require=" + JSON.stringify(trusted)); i++; continue;
    }
    // Harmless Vitest worker export conditions are not child application guards.
    if (/^--conditions=(node|development)$/.test(option)) continue;
    if (option === "--conditions" && ["node", "development"].includes(execArgv[i + 1])) { i++; continue; }
    unsupported();
  }
  const inheritedSelectors = Object.fromEntries(passthrough.filter(key => typeof inherited[key] === "string").map(key => [key, inherited[key]]));
  const heapOptions = [nodeOptions, ...cliHeap].filter(value => value !== undefined && value !== "").join(" ");
  const preservedOptions = [heapOptions.trim() ? heapOptions : "--max-old-space-size=3072", ...framework].join(" ");
  return { ...inheritedSelectors, NODE_ENV: "development", NODE_OPTIONS: preservedOptions };
}
function ownedDatabase(databaseUrl: string): void {
  try {
    const database = new URL(databaseUrl);
    if (database.protocol !== "postgresql:" || database.hostname !== "127.0.0.1" || !database.port || database.pathname !== "/axiom_new_test_contract_rehearsal" || database.username !== "postgres" || !database.password || database.search || database.hash) throw new Error("invalid");
  } catch { throw new Error("owned_test_child_scope_required"); }
}
/** Internal owned-fixture launcher only. Copy managed transport selectors
 * opaquely; never remove inherited preloads/guards in order to start a child.
 * Unsupported Node/trust configuration refuses launch, without echoing values.
 * This neither makes a provider permit nor proves managed proxy compatibility. */
export function newTestChildEnvironment(inherited: Readonly<Record<string, string | undefined>>, execArgv: readonly string[], fixture: {
  databaseUrl: string; appOrigin: string; fontResponses: string;
  runtimeId: string; accountId: string; organizationId: string; authSecret: string;
}): NodeJS.ProcessEnv {
  const inheritedEnvironment = checkedChildEnvironment(inherited, execArgv);
  ownedDatabase(fixture.databaseUrl);
  const origin = new URL(fixture.appOrigin);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash
    || !isAbsolute(fixture.fontResponses) || !fixture.runtimeId || !fixture.accountId || !fixture.organizationId || !fixture.authSecret) throw new Error("owned_test_child_scope_required");
  return {
    ...inheritedEnvironment, NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1", NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fixture.fontResponses,
    DATABASE_URL: fixture.databaseUrl, DIRECT_URL: fixture.databaseUrl, NEXTAUTH_URL: fixture.appOrigin, NEXTAUTH_SECRET: fixture.authSecret,
    AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", AXIOM_ISOLATED_TEST_RUNTIME_ID: fixture.runtimeId,
    AXIOM_ISOLATED_TEST_ACCOUNT_ID: fixture.accountId, AXIOM_ISOLATED_TEST_ORGANIZATIONS: fixture.organizationId,
    AI_GATEWAY_API_KEY: "synthetic-inert-not-a-provider-credential", AI_GATEWAY_MODEL: "openai/gpt-4o-mini", AXIOM_AI_MAX_REQUEST_CREDITS_CENTS: "100",
    AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true",
  };
}

/** Prisma CLI gets the same checked managed selectors, no ambient secrets and
 * only the explicit new owned database. No Next/provider credential is copied. */
export function newTestPrismaEnvironment(inherited: Readonly<Record<string, string | undefined>>, execArgv: readonly string[], databaseUrl: string): NodeJS.ProcessEnv {
  const inheritedEnvironment = checkedChildEnvironment(inherited, execArgv); ownedDatabase(databaseUrl);
  return { ...inheritedEnvironment, NODE_ENV: "development", DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, SHADOW_DATABASE_URL: databaseUrl, CHECKPOINT_DISABLE: "1",
    AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true" };
}
