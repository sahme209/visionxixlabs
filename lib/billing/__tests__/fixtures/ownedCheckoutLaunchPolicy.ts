/** Owned bridge launcher only. Adapted from the reviewed premium managed-path
 * metadata policy; does not relax the existing billing child helper. */
import { createHash } from "node:crypto";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { dirname, normalize } from "node:path";
import { checkedChildEnvironment } from "./newTestChildEnvironment";
const reviewedPathHash = "dbc7bc884f72c70bb3d320e868da710a56a621286fba48b3c6b610776b41b4fd";
function unsupported(): never { throw new Error("owned_checkout_launch_policy_unsupported"); }
type PathIO = { digest(value: string): string; realpath(path: string): string; lstat(path: string): { isDirectory(): boolean; isSymbolicLink(): boolean; uid: number; gid: number; mode: number; dev: number; ino: number; ctimeMs: number }; uid(): number | undefined; writable(path: string): boolean };
const system: PathIO = {
  digest: (value: string) => createHash("sha256").update(value).digest("hex"), realpath: realpathSync, lstat: lstatSync,
  uid: () => process.getuid?.(), writable: (path: string) => { try { accessSync(path, constants.W_OK); return true; } catch (error) { if (["EACCES", "EROFS"].includes((error as NodeJS.ErrnoException).code ?? "")) return false; throw error; } },
};
export function captureOwnedNodePath(value: string | undefined, io = system) {
  if (value === undefined) return null;
  try {
    if (value.length > 4096 || !/^\/(usr|opt|run)(\/|$)/.test(value) || /[:\0]/.test(value) || normalize(value) !== value || io.digest(value) !== reviewedPathHash || io.realpath(value) !== value) unsupported();
    const ancestors = [];
    for (let path = value; ; path = dirname(path)) {
      if (ancestors.length >= 32) unsupported(); const row = io.lstat(path);
      if (!row.isDirectory() || row.isSymbolicLink() || io.realpath(path) !== path || ![0, 65534].includes(row.uid) || row.gid !== row.uid || row.uid === io.uid() || (row.mode & 0o7022) !== 0 || io.writable(path) || path === value && (row.mode & 0o7777) !== 0o755) unsupported();
      const identity = { path, dev: row.dev, ino: row.ino, mode: row.mode, uid: row.uid, gid: row.gid, ctimeMs: row.ctimeMs };
      if (![identity.dev, identity.ino, identity.mode, identity.uid, identity.gid, identity.ctimeMs].every(Number.isFinite)) unsupported(); ancestors.push(identity); if (path === "/") break;
    }
    return { valueSha256: reviewedPathHash, realpath: value, ancestors };
  } catch { return unsupported(); }
}
const managedSelectorKeys = [
  "PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL",
  "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "NODE_USE_ENV_PROXY",
  "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "CODEX_PROXY_CERT", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "AWS_CA_BUNDLE",
  "NODE_ENV", "NODE_OPTIONS", "NODE_PATH", "VERCEL", "VERCEL_ENV",
] as const;
function checkedDeployment(value: Readonly<Record<string, string | undefined>>) {
  if (value.NODE_ENV === "production" || value.VERCEL !== undefined || value.VERCEL_ENV !== undefined) unsupported();
}
function checkedControls(value: Readonly<Record<string, string | undefined>>) {
  for (const key of Object.keys(value)) if (/^(LD_|DYLD_|OPENSSL_)/.test(key) || key.startsWith("NODE_") && !["NODE_OPTIONS", "NODE_ENV", "NODE_EXTRA_CA_CERTS", "NODE_USE_ENV_PROXY", "NODE_PATH"].includes(key)) unsupported();
}
export function ownedCheckoutLaunchPolicy(inherited: Readonly<Record<string, string | undefined>>, execArgv: readonly string[]) {
  try {
    checkedDeployment(inherited);
    checkedControls(inherited);
    const managedNodePath = captureOwnedNodePath(inherited.NODE_PATH);
    const env = { ...checkedChildEnvironment(inherited, execArgv), ...(inherited.NODE_PATH === undefined ? {} : { NODE_PATH: inherited.NODE_PATH }) };
    // Fixed complete key universe: absence is part of the identity. A selector
    // first appearing after capture must not disappear from the comparison.
    const signature = (value: Readonly<Record<string, string | undefined>>) => JSON.stringify(managedSelectorKeys.map(key => [key, Object.prototype.hasOwnProperty.call(value, key), value[key] ?? null]));
    const inheritedSignature = signature(inherited), childSignature = signature(env);
    return { env, managedNodePath, revalidate(current: Readonly<Record<string, string | undefined>>, scope: "parent" | "child" = "parent") {
      checkedDeployment(current); checkedControls(current);
      if (signature(current) !== (scope === "child" ? childSignature : inheritedSignature) || JSON.stringify(captureOwnedNodePath(current.NODE_PATH)) !== JSON.stringify(managedNodePath)) unsupported();
    } };
  } catch { return unsupported(); }
}
