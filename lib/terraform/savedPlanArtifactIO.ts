import "server-only";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { constants } from "node:fs";
import { mkdtemp, mkdir, open, writeFile, rm, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { bytesDigest, MAX_PLAN_BYTES, MAX_SHOW_BYTES, parseSavedPlanBinding, inspectSavedPlanJson, savedPlanArtifactContext, type SavedPlanBinding, type SavedPlanRecord } from "./savedPlanArtifact";

const execute = promisify(execFile);
async function regularBytes(path: string, limit: number): Promise<Buffer> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size === 0 || stat.size > limit) throw new Error("saved_plan_file_invalid");
    const bytes = await file.readFile();
    if (bytes.length !== stat.size || bytes.length > limit) throw new Error("saved_plan_file_changed");
    return bytes;
  } finally { await file.close(); }
}

/** Internal, fixture-only producer boundary. No route accepts these arguments.
 * Binary comes from the owned producer; show JSON is always derived here.
 * No init, plan, provider, backend, apply or inherited customer environment. */
export async function captureSavedPlan(input: { id: string; binding: SavedPlanBinding; binary: Buffer; executablePath: string }): Promise<SavedPlanRecord> {
  const binding = parseSavedPlanBinding(input.binding);
  if (!Buffer.isBuffer(input.binary) || input.binary.length === 0 || input.binary.length > MAX_PLAN_BYTES || !isAbsolute(input.executablePath)) throw new Error("saved_plan_capture_input_invalid");
  const expectedExecutable = binding.executableDigest;
  if (bytesDigest(await regularBytes(input.executablePath, 128 * 1024 * 1024)) !== expectedExecutable) throw new Error("saved_plan_executable_changed");
  const directory = await mkdtemp(join(tmpdir(), "axiom-saved-plan-capture-"));
  try {
    const snapshot = join(directory, "snapshot.tfplan");
    const bytes = Buffer.from(input.binary);
    const expected = bytesDigest(bytes);
    await writeFile(snapshot, bytes, { mode: 0o600, flag: "wx" });
    await mkdir(join(directory, "providers"), { mode: 0o700 });
    await mkdir(join(directory, "data"), { mode: 0o700 });
    const config = join(directory, "terraform.tfrc");
    await writeFile(config, `disable_checkpoint = true\nprovider_installation { filesystem_mirror { path = ${JSON.stringify(join(directory, "providers"))} } }\n`, { mode: 0o600, flag: "wx" });
    const options = { cwd: directory, env: { PATH: "/usr/bin:/bin", TF_IN_AUTOMATION: "1", TF_INPUT: "0", CHECKPOINT_DISABLE: "1", TF_CLI_CONFIG_FILE: config, TF_DATA_DIR: join(directory, "data") },
      timeout: 30_000, maxBuffer: MAX_SHOW_BYTES, encoding: "utf8" as const, windowsHide: true };
    const version = await execute(input.executablePath, ["version", "-json"], { ...options, maxBuffer: 64 * 1024 });
    if ((JSON.parse(version.stdout) as { terraform_version?: unknown }).terraform_version !== binding.terraformVersion) throw new Error("saved_plan_cli_version_changed");
    if (bytesDigest(await regularBytes(input.executablePath, 128 * 1024 * 1024)) !== expectedExecutable) throw new Error("saved_plan_executable_changed");
    const result = await execute(input.executablePath, ["show", "-json", snapshot], options);
    if ((await lstat(snapshot)).isSymbolicLink() || bytesDigest(await regularBytes(snapshot, MAX_PLAN_BYTES)) !== expected) throw new Error("saved_plan_snapshot_changed");
    if (bytesDigest(await regularBytes(input.executablePath, 128 * 1024 * 1024)) !== expectedExecutable) throw new Error("saved_plan_executable_changed");
    return sealSavedPlan(input.id, binding, bytes, result.stdout);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

/** Internal producer primitive. Only captureSavedPlan may supply the binary
 * and its CLI-derived show. This is not a public upload/authority boundary. */
function sealSavedPlan(id: string, suppliedBinding: SavedPlanBinding, binary: Buffer, show: string): SavedPlanRecord {
  const binding = parseSavedPlanBinding(suppliedBinding);
  if ((typeof id !== "string" || id.length === 0 || id.length > 1024) || binary.length === 0 || binary.length > MAX_PLAN_BYTES) throw new Error("saved_plan_bytes_invalid");
  inspectSavedPlanJson(show, binding.terraformVersion);
  const base = { id, organizationId: binding.organizationId, deploymentRequestId: binding.deploymentRequestId, requestVersion: binding.requestVersion,
    bindingJson: binding, bindingDigest: sha256ContentHash(binding), binaryDigest: bytesDigest(binary), binaryBytes: binary.length,
    showDigest: bytesDigest(show), createdAt: new Date(binding.createdAt), expiresAt: new Date(binding.expiresAt) };
  return { ...base, encryptedBinary: encryptScopedCredential(binary.toString("base64"), savedPlanArtifactContext(base, "binary")), encryptedShow: encryptScopedCredential(show, savedPlanArtifactContext(base, "show")) };
}

