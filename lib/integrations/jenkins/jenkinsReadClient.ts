import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { unsafeAddress } from "@/lib/integrations/airflow/airflowClient";
import { boundedText, getJson, isRecord, providerLink } from "../readOnlyHttp";

/**
 * Jenkins read-only client: jobs and their last build result, so V19 can show CI state for teams on
 * Jenkins. Uses a user and API token with Overall/Read and Job/Read only. GET only: never builds,
 * aborts or configures a job. Public HTTPS hosts only. Live acceptance pending.
 */
export type JenkinsResult = "SUCCESS" | "FAILURE" | "UNSTABLE" | "ABORTED" | "NOT_BUILT" | "IN_PROGRESS" | "UNKNOWN";
export interface JenkinsJob { name: string; url: string | null; lastBuild: { number: number; result: JenkinsResult; at: string | null } | null }
const RESULTS = new Set(["SUCCESS", "FAILURE", "UNSTABLE", "ABORTED", "NOT_BUILT"]);

export async function validateJenkinsBaseUrl(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("jenkins_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("jenkins_https_url_required");
  const raw = value.match(/^https:\/\/[^\\/?#\s]+([^?#\s]*)$/i);
  if (!raw || !/^(?:\/|\/[A-Za-z0-9_-]+\/?)?$/.test(raw[1])) throw new Error("jenkins_base_url_invalid");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || /\.(localhost|local|internal|svc)$/.test(hostname)) throw new Error("jenkins_private_host_blocked");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) throw new Error("jenkins_private_host_blocked");
  return `${url.origin}${raw[1].replace(/\/$/, "")}`;
}

export class JenkinsReadClient {
  private readonly host: string;
  constructor(private readonly baseUrl: string, private readonly user: string, private readonly apiToken: string) {
    if (!/^[A-Za-z0-9._@-]{1,100}$/.test(user) || !apiToken || apiToken.length > 200) throw new Error("jenkins_credentials_invalid");
    this.host = new URL(baseUrl).hostname;
  }

  async listJobs(): Promise<JenkinsJob[]> {
    const tree = "jobs[name,url,lastBuild[number,result,building,timestamp]]";
    const body = await getJson(`${this.baseUrl}/api/json?tree=${encodeURIComponent(tree)}`, { authorization: `Basic ${Buffer.from(`${this.user}:${this.apiToken}`).toString("base64")}` }, "jenkins");
    if (!isRecord(body) || !Array.isArray(body.jobs) || body.jobs.length > 2000) throw new Error("jenkins_response_invalid");
    return body.jobs.filter(isRecord).flatMap((j) => {
      const name = boundedText(j.name, 200);
      if (!name) return [];
      const b = isRecord(j.lastBuild) ? j.lastBuild : null;
      const lastBuild = b && Number.isSafeInteger(b.number) ? { number: b.number as number, result: (b.building === true ? "IN_PROGRESS" : RESULTS.has(b.result as string) ? b.result : "UNKNOWN") as JenkinsResult, at: typeof b.timestamp === "number" ? new Date(b.timestamp).toISOString() : null } : null;
      return [{ name, url: providerLink(j.url, this.host), lastBuild }];
    }).slice(0, 200);
  }
}
