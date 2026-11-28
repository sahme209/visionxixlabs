import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseManagedPolicy } from "../../../desktop/src/lib/managedPolicy";

const dir = mkdtempSync(join(tmpdir(), "v19-policy-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const parse = (file: string) => parseManagedPolicy({ status: "found", path: file, contents: readFileSync(file, "utf8") });
const hasPwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "exit 0"]).status === 0;

describe.each(["macos", "linux"])("v19-policy-%s.sh", (os) => {
  const script = `public/enterprise/v19-policy-${os}.sh`;
  const run = (name: string, args: string[]) => {
    const file = join(dir, `${os}-${name}.json`);
    const r = spawnSync("bash", [script, ...args], { env: { ...process.env, V19_POLICY_FILE: file }, encoding: "utf8" });
    return { file, status: r.status, stderr: r.stderr };
  };
  it("writes a file the app accepts", () => {
    const r = run("full", ["Example Health IT", "org_abc, org-2", "false"]);
    expect(r.status).toBe(0);
    expect(parse(r.file)).toEqual({ kind: "ok", path: r.file, policy: { managedBy: "Example Health IT", allowedWorkspaceIds: ["org_abc", "org-2"], updateNotices: false, serverUrl: null } });
    const empty = run("empty", ["", "", ""]);
    expect(parse(empty.file)).toMatchObject({ kind: "ok", policy: { managedBy: null, allowedWorkspaceIds: null, updateNotices: true } });
  });
  it("sets the company's own V19 server and refuses a non-HTTPS one", () => {
    const r = run("server", ["", "", "", "https://v19.corp.example:8443/"]);
    expect(parse(r.file)).toMatchObject({ kind: "ok", policy: { serverUrl: "https://v19.corp.example:8443" } });
    expect(run("server-bad", ["", "", "", "http://v19.corp.example"]).status).not.toBe(0);
  });
  it("accepts Jamf-style parameters 4 to 6", () => {
    const r = run("jamf", ["/", "host", "user", "Acme", "org_x", "true"]);
    expect(parse(r.file)).toMatchObject({ kind: "ok", policy: { managedBy: "Acme", allowedWorkspaceIds: ["org_x"], updateNotices: true } });
  });
  it("refuses values that would make an invalid or misleading file", () => {
    for (const args of [['Bad "name"', "", ""], ["ok", "org one", ""], ["ok", "", "maybe"], ["x".repeat(81), "", ""]]) {
      expect(run("bad", args).status).not.toBe(0);
    }
  });
});

describe.skipIf(!hasPwsh)("v19-policy-windows.ps1", () => {
  it("writes a UTF-8 file without a byte-order mark that the app accepts, keeping one ID as a list", () => {
    const file = join(dir, "win.json");
    execFileSync("pwsh", ["-NoProfile", "-File", "public/enterprise/v19-policy-windows.ps1", "-ManagedBy", "Example Health IT", "-AllowedWorkspaceIds", "org_abc", "-UpdateNotices:$false", "-Path", file]);
    expect(readFileSync(file)[0]).toBe(0x7b);
    expect(parse(file)).toMatchObject({ kind: "ok", policy: { managedBy: "Example Health IT", allowedWorkspaceIds: ["org_abc"], updateNotices: false } });
  });
});
