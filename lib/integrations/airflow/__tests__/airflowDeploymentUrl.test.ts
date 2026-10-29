import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
import { AirflowClient, validateAirflowBaseUrl } from "../airflowClient";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("hosted Airflow deployment boundary", () => {
  it.each(["", "/", "/dz3uu847", "/dz3uu847/"])("preserves a supported base %s", async path => {
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
    expect(await validateAirflowBaseUrl(`https://fixture.astronomer.run${path}`)).toBe(`https://fixture.astronomer.run${path.replace(/\/$/, "")}`);
  });
  it.each(["/a/../other", "/a/%2e%2e/other", "/%2Fother", "/a\\other", "/api/v2", "/home", "/auth", "/a//", "/a%3fb", "/a?next=x", "/a#fragment"])("rejects ambiguous or UI/API paths %s", async path => {
    await expect(validateAirflowBaseUrl(`https://fixture.astronomer.run${path}`)).rejects.toThrow();
    expect(dns.lookup).not.toHaveBeenCalled();
  });
  it.each([" https://fixture.astronomer.run/a/../other", "https://fixture.astronomer.run/a ", "https://fixture.astronomer.run\\other/a"])("rejects unnormalized raw URL %s", async value => {
    await expect(validateAirflowBaseUrl(value)).rejects.toThrow();
    expect(dns.lookup).not.toHaveBeenCalled();
  });
  it("retains private DNS and explicit host restrictions", async () => {
    dns.lookup.mockResolvedValue([{ address: "127.0.0.1" }]);
    await expect(validateAirflowBaseUrl("https://fixture.astronomer.run/deployment")).rejects.toThrow("airflow_private_host_blocked");
    vi.stubEnv("AIRFLOW_ALLOWED_HOSTS", "other.example.com");
    await expect(validateAirflowBaseUrl("https://fixture.astronomer.run/deployment")).rejects.toThrow("airflow_host_not_allowed");
  });
  it("keeps validation and exact run reads inside the deployment with bearer auth and no redirects", async () => {
    const fetcher = vi.fn().mockImplementation(async (url, init) => {
      expect(url.startsWith("https://fixture.astronomer.run/dz3uu847/api/v2/")).toBe(true);
      expect(init.redirect).toBe("error");
      expect(init.headers.authorization).toBe("Bearer fixture-token");
      if(url.endsWith("/version")) return Response.json({version:"3.3.2"});
      if(url.includes("/dags?")) return Response.json({dags:[],total_entries:0});
      return Response.json({dag_id:"daily",dag_run_id:"run1",state:"success"});
    });
    vi.stubGlobal("fetch",fetcher);
    const client=new AirflowClient("https://fixture.astronomer.run/dz3uu847",{authMode:"token",token:"fixture-token"});
    expect(await client.validate()).toEqual({version:"3.3.2",dagCount:0});
    expect(await client.getDagRun("daily","run1")).toMatchObject({state:"success"});
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
