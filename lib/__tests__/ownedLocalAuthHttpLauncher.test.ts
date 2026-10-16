import { describe, expect, it } from "vitest";
import { runOwnedLocalAuthHttp } from "../../scripts/run-owned-local-auth-http.mjs";
function fixture(mode = "success") {
  const calls: string[][] = [];
  let owner = "";
  const id = "a".repeat(64);
  const execute = async (args: string[]) => {
    calls.push(args);
    const command = args.slice(2);
    if (command[0] === "image") return { status: mode === "missing-image" ? 1 : 0, stdout: "", stderr: "" };
    if (command[0] === "run") { owner = command.find(value => value.startsWith("io.axiom.local-auth-owner="))!.split("=")[1]; return { status: mode === "run-failed" ? 1 : 0, stdout: id + "\n", stderr: "" }; }
    if (command[0] === "port") return { status: 0, stdout: mode === "unsafe-bind" ? "0.0.0.0:32100\n" : "127.0.0.1:32100\n", stderr: "" };
    if (command[0] === "exec") return { status: mode === "not-ready" ? 1 : 0, stdout: "", stderr: "" };
    if (command[0] === "inspect") return { status: 0, stdout: mode === "wrong-owner" ? "foreign-owner\n" : owner + "\n", stderr: "" };
    if (command[0] === "rm") return { status: 0, stdout: "", stderr: "" };
    throw Error("unexpected docker command");
  };
  const observed: string[] = [];
  const rehearse = async (url: string) => { observed.push(url); if (mode === "journey-failed") throw Error("synthetic-private-token"); return { verified: ["fixture_only"], productionChanges: false }; };
  return { calls, observed, execute, rehearse, sleep: async () => {} };
}
describe("owned local auth HTTP launcher safety", () => {
  it.each([{}, { AXIOM_RUN_LOCAL_AUTH_HTTP: "true" }])("requires exact opt-in before any container operation", async env => {
    const f = fixture(); await expect(runOwnedLocalAuthHttp(env, f)).rejects.toThrow("local_auth_http_opt_in_required"); expect(f.calls).toEqual([]);
  });
  it.each(["DATABASE_URL", "DIRECT_URL", "AUTH_HTTP_TEST_DATABASE_URL", "DOCKER_HOST", "DOCKER_CONTEXT", "NEXTAUTH_URL", "STRIPE_SECRET_KEY", "POSTGRES_DB", "PGPASSFILE"])("refuses inherited database/daemon binding %s", async key => {
    const f = fixture(); await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", [key]: "existing-binding" }, f)).rejects.toThrow("local_auth_http_external_binding_forbidden"); expect(f.calls).toEqual([]);
  });
  it("uses only cached image, loopback binding, actual TCP readiness and exact owned cleanup", async () => {
    const f = fixture(); const result = await runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1" }, f);
    expect(f.observed).toHaveLength(1); expect(f.observed[0]).toMatch(/^postgresql:\/\/fixture:[a-f0-9]+@127\.0\.0\.1:32100\/axiom_auth_http_[a-f0-9]{12}$/);
    const run = f.calls.find(args => args[2] === "run")!;
    expect(run).toContain("--pull=never"); expect(run).toContain("127.0.0.1::5432"); expect(run).not.toContain("--privileged");
    expect(f.calls.find(args => args[2] === "exec")).toContain("127.0.0.1");
    expect(f.calls.at(-1)).toEqual(["--host", "unix:///var/run/docker.sock", "rm", "--force", "--volumes", "a".repeat(64)]);
    expect(result.fixtureCleanup).toBe("owned_disposable_container_removed"); expect(JSON.stringify(result)).not.toContain(f.observed[0]);
  });
  it.each(["unsafe-bind", "not-ready", "journey-failed"])("cleans exact owned container after %s without returning secrets", async mode => {
    const f = fixture(mode); await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1" }, f)).rejects.toThrow(/^owned_local_auth_http_failed$/);
    expect(f.calls.at(-1)?.[2]).toBe("rm"); if (mode !== "journey-failed") expect(f.observed).toEqual([]);
  });
  it.each(["missing-image", "run-failed"])("never removes a container it did not create after %s", async mode => {
    const f = fixture(mode); await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1" }, f)).rejects.toThrow("owned_local_auth_http_failed"); expect(f.calls.some(args => args[2] === "rm")).toBe(false);
  });
  it("cleans owned fixture once on interruption and never reports acceptance", async () => {
    const f = fixture(); const controller = new AbortController();
    await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1" }, { ...f, signal: controller.signal, rehearse: async () => { controller.abort(); return { verified: ["must_not_report"] }; } })).rejects.toThrow("owned_local_auth_http_failed");
    expect(f.calls.filter(args => args[2] === "rm")).toHaveLength(1);
  });
  it("refuses deletion when ownership cannot be established", async () => {
    const f = fixture("wrong-owner"); await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1" }, f)).rejects.toThrow("owned_local_auth_http_cleanup_unverified"); expect(f.calls.some(args => args[2] === "rm")).toBe(false);
  });
});
it("requires a separate exact AWS wire opt-in and otherwise preserves the auth-only call", async () => {
  const f = fixture();
  let options;
  await runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_AWS_HTTP: "1" }, { ...f, rehearse: async (_url: string, value: unknown) => { options = value; return { verified: [] }; } });
  expect(options).toEqual({ awsWireFixture: true });
  const invalid = fixture();
  await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_AWS_HTTP: "true" }, invalid)).rejects.toThrow("local_aws_http_opt_in_invalid");
  expect(invalid.calls).toEqual([]);
});

it("requires a separate exact synthetic receipt opt-in without enabling the AWS fixture", async () => {
  const f = fixture();
  let options;
  await runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_AGENT_RECEIPT_HTTP: "1" }, { ...f, rehearse: async (_url: string, value: unknown) => { options = value; return { verified: [] }; } });
  expect(options).toEqual({ agentReceiptFixture: true });
  const invalid = fixture();
  await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_AGENT_RECEIPT_HTTP: "true" }, invalid)).rejects.toThrow("local_agent_receipt_http_opt_in_invalid");
  expect(invalid.calls).toEqual([]);
});

it("opts into actual Agent disabled-state HTTP without enabling a provider or synthetic dispatch receipt", async () => {
  const f = fixture();
  let options;
  await runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_AGENT_READINESS_HTTP: "1" }, { ...f, rehearse: async (_url: string, value: unknown) => { options = value; return { verified: [] }; } });
  expect(options).toEqual({ agentReadinessFixture: true });
  const invalid = fixture();
  await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_AGENT_READINESS_HTTP: "true" }, invalid)).rejects.toThrow("local_agent_readiness_http_opt_in_invalid");
  expect(invalid.calls).toEqual([]);
});

it("requires an explicit saved Terraform fixture and exact owned executable path", async () => {
  const f = fixture(); let options;
  const executable = "/tmp/axiom-terraform-artifact-fixture/bin/terraform";
  await runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_TERRAFORM_HTTP: "1", AXIOM_LOCAL_TERRAFORM_EXECUTABLE: executable }, { ...f, rehearse: async (_url: string, value: unknown) => { options = value; return { verified: [] }; } });
  expect(options).toEqual({ savedTerraformFixture: true, savedTerraformExecutable: executable });
  const invalid = fixture();
  await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_TERRAFORM_HTTP: "true" }, invalid)).rejects.toThrow("local_terraform_http_opt_in_invalid");
  expect(invalid.calls).toEqual([]);
  await expect(runOwnedLocalAuthHttp({ AXIOM_RUN_LOCAL_AUTH_HTTP: "1", AXIOM_RUN_LOCAL_TERRAFORM_HTTP: "1", AXIOM_LOCAL_TERRAFORM_EXECUTABLE: "/usr/bin/terraform" }, invalid)).rejects.toThrow("owned_saved_plan_executable_required");
  expect(invalid.calls).toEqual([]);
});

it("opts into Azure wire only explicitly and preserves separate owned encryption/transport authority", async () => {
 const f=fixture();let options;
 await runOwnedLocalAuthHttp({AXIOM_RUN_LOCAL_AUTH_HTTP:"1",AXIOM_RUN_LOCAL_AZURE_HTTP:"1"},{...f,rehearse:async(_url:string,value:unknown)=>{options=value;return {verified:[]};}});
 expect(options).toEqual({azureWireFixture:true});
 const invalid=fixture();await expect(runOwnedLocalAuthHttp({AXIOM_RUN_LOCAL_AUTH_HTTP:"1",AXIOM_RUN_LOCAL_AZURE_HTTP:"true"},invalid)).rejects.toThrow("local_azure_http_opt_in_invalid");expect(invalid.calls).toEqual([]);
 for(const flag of ["AXIOM_RUN_LOCAL_AWS_HTTP","AXIOM_RUN_LOCAL_TERRAFORM_HTTP"]){const separate=fixture();await expect(runOwnedLocalAuthHttp({AXIOM_RUN_LOCAL_AUTH_HTTP:"1",AXIOM_RUN_LOCAL_AZURE_HTTP:"1",[flag]:"1"},separate)).rejects.toThrow("separate_owned_azure_fixture_required");expect(separate.calls).toEqual([]);}
});
