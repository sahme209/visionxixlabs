import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertCommittedApplicationSource, assertNoRuntimeDotenv, localAuthChildEnvironment, validateLocalAuthHttpTarget, writePrivateAuthHttpDiagnostics } from "../../scripts/rehearse-local-auth-http.mjs";
const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const fixture = { databaseUrl: "postgresql://fixture:fixture-only@127.0.0.1:5439/axiom_auth_http_012345abcdef", appOrigin: "http://127.0.0.1:34801", mailOrigin: "http://127.0.0.1:34802" };
describe("real local auth rehearsal safety boundary", () => {
  it("requires an explicitly named disposable database on literal loopback", () => {
    expect(validateLocalAuthHttpTarget(fixture.databaseUrl)).toBe(fixture.databaseUrl);
  });
  it.each([undefined, "postgresql://user:password@production.neon.tech/axiom_auth_http_012345abcdef", "postgresql://user:password@localhost:5432/axiom_auth_http_012345abcdef", "postgresql://user:password@127.0.0.1/axiom_auth_http_012345abcdef", "postgresql://user:password@127.0.0.1:5432/production", fixture.databaseUrl + "?schema=public", fixture.databaseUrl + "#fragment"])("refuses unsafe or absent database input %s", (value) => {
    expect(() => validateLocalAuthHttpTarget(value)).toThrow("isolated_auth_http_target_required");
  });
  it("does not inherit app/provider credentials, DATABASE_URL, NODE_OPTIONS or fallback production origins", () => {
    const inherited = { PATH: "/bin", HTTPS_PROXY: "http://guard.invalid", NODE_EXTRA_CA_CERTS: "/fixture-ca", DATABASE_URL: "production", STRIPE_SECRET_KEY: "live", RESEND_API_KEY: "real", GOOGLE_CLIENT_SECRET: "real", NODE_OPTIONS: "--import unknown", NEXTAUTH_URL: "https://production.invalid" };
    const env = localAuthChildEnvironment(inherited, fixture);
    expect(env.DATABASE_URL).toBe(fixture.databaseUrl);
    expect(env.RESEND_BASE_URL).toBe(fixture.mailOrigin);
    expect(env.NEXTAUTH_URL).toBe(fixture.appOrigin);
    expect(env.HTTPS_PROXY).toBe(inherited.HTTPS_PROXY);
    expect(env.NODE_EXTRA_CA_CERTS).toBe(inherited.NODE_EXTRA_CA_CERTS);
    expect(env).not.toHaveProperty("STRIPE_SECRET_KEY");
    expect(env).not.toHaveProperty("GOOGLE_CLIENT_SECRET");
    expect(env).not.toHaveProperty("NODE_OPTIONS");
  });
  it.each(["https://127.0.0.1:3000", "http://localhost:3000", "http://user:pass@127.0.0.1:3000", "http://127.0.0.1:3000/remote", "https://api.resend.com"])("refuses non-isolated app/mail origin %s", (origin) => {
    expect(() => localAuthChildEnvironment({}, { ...fixture, mailOrigin: origin })).toThrow("loopback_origin_required");
  });
  it.each([".env", ".env.local", ".env.production", ".env.development.local", ".env.test", ".env.other"])("refuses all runtime dotenv fallbacks %s", (name) => {
    const directory = mkdtempSync(join(tmpdir(), "axiom-http-env-")); directories.push(directory);
    writeFileSync(join(directory, ".env.example"), "template");
    expect(() => assertNoRuntimeDotenv(directory)).not.toThrow();
    writeFileSync(join(directory, name), "not-read");
    expect(() => assertNoRuntimeDotenv(directory)).toThrow("runtime_dotenv_forbidden");
  });
});


function sourceFixture() {
  const directory = mkdtempSync(join(tmpdir(), "axiom-http-source-")); directories.push(directory);
  const paths = ["app/api/auth/example.ts", "lib/db.ts", "lib/auth/workspaceId.ts", "components/auth/Example.tsx", "prisma/schema.prisma", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "instrumentation.ts"];
  for (const path of paths) { mkdirSync(dirname(join(directory, path)), { recursive: true }); writeFileSync(join(directory, path), "fixture-source"); }
  const git = (...args: string[]) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], { cwd: directory, stdio: "pipe" });
  git("init", "--quiet"); git("add", ".");
  git("-c", "user.name=Synthetic Fixture", "-c", "user.email=fixture@example.test", "commit", "--quiet", "-m", "Synthetic source fixture");
  return { directory, git, paths };
}
describe("HTTP evidence source and private diagnostics", () => {
  it("accepts only a complete clean checkout and reports its actual commit", () => {
    const fixture = sourceFixture();
    expect(assertCommittedApplicationSource(fixture.directory)).toBe(fixture.git("rev-parse", "HEAD").toString().trim());
  });
  it.each(["lib/db.ts", "lib/auth/workspaceId.ts", "components/auth/Example.tsx", "package-lock.json", "next.config.ts", "instrumentation.ts"])("rejects dirty runtime dependency %s", (path) => {
    const fixture = sourceFixture(); writeFileSync(join(fixture.directory, path), "changed-source");
    expect(() => assertCommittedApplicationSource(fixture.directory)).toThrow("committed_application_source_required");
  });
  it("rejects staged changes and new runtime source outside the former auth-only guard", () => {
    const fixture = sourceFixture(); writeFileSync(join(fixture.directory, "lib/db.ts"), "changed-source"); fixture.git("add", "lib/db.ts");
    expect(() => assertCommittedApplicationSource(fixture.directory)).toThrow("committed_application_source_required");
    fixture.git("restore", "--staged", "lib/db.ts"); fixture.git("restore", "lib/db.ts");
    writeFileSync(join(fixture.directory, "lib/new-helper.ts"), "new-source");
    expect(() => assertCommittedApplicationSource(fixture.directory)).toThrow("untracked_application_source_forbidden");
  });
  it("writes distinct private diagnostics without following or overwriting a shared filename", () => {
    const directory = mkdtempSync(join(tmpdir(), "axiom-http-diagnostic-test-")); directories.push(directory);
    const sentinel = join(directory, "sentinel.json"); writeFileSync(sentinel, "untouched");
    symlinkSync(sentinel, join(directory, "axiom-auth-http-private-diagnostics.json"));
    const first = writePrivateAuthHttpDiagnostics({ marker: "synthetic-first" }, directory);
    const second = writePrivateAuthHttpDiagnostics({ marker: "synthetic-second" }, directory);
    expect(first).not.toBe(second);
    expect(readFileSync(sentinel, "utf8")).toBe("untouched");
    expect(JSON.parse(readFileSync(first, "utf8"))).toEqual({ marker: "synthetic-first" });
    expect(statSync(first).mode & 0o777).toBe(0o600);
    expect(statSync(dirname(first)).mode & 0o777).toBe(0o700);
  });
});
