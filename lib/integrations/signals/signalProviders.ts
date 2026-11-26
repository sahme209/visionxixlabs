import "server-only";

import { ArgoCdClient, validateArgoCdBaseUrl } from "@/lib/integrations/argocd/argoCdClient";
import { FluxClient, validateFluxApiBaseUrl } from "@/lib/integrations/flux/fluxClient";
import { PagerDutyReadClient } from "@/lib/integrations/pagerduty/pagerDutyReadClient";
import { OpsgenieReadClient } from "@/lib/integrations/opsgenie/opsgenieReadClient";
import { SentryReadClient } from "@/lib/integrations/sentry/sentryReadClient";
import { DatadogReadClient, DATADOG_SITES, type DatadogSite } from "@/lib/integrations/datadog/datadogReadClient";
import { LaunchDarklyReadClient } from "@/lib/integrations/launchdarkly/launchDarklyReadClient";
import { UnleashReadClient, validateUnleashBaseUrl } from "@/lib/integrations/unleash/unleashReadClient";

/**
 * Read-only signal providers: GitOps controllers, incident tools, error tracking, monitoring and feature
 * flags. One closed union and one descriptor each, like the Batches providers. Connecting validates the
 * credential with one bounded read and stores it encrypted; every client is observation only.
 */
export const SIGNAL_PROVIDERS = ["argo_cd", "flux", "pagerduty", "opsgenie", "sentry", "datadog", "launchdarkly", "unleash"] as const;
export type SignalProvider = (typeof SIGNAL_PROVIDERS)[number];
export const isSignalProvider = (v: unknown): v is SignalProvider => typeof v === "string" && (SIGNAL_PROVIDERS as readonly string[]).includes(v);

/** Non-secret settings saved beside the encrypted credential. */
export type SignalSettings = Record<string, string>;
export interface SignalDescriptor {
  label: string;
  /** Validates untrusted input into non-secret settings and the secret fields to encrypt. */
  parse(input: Record<string, unknown>): Promise<{ settings: SignalSettings; secret: Record<string, string> }>;
  /** One bounded read proving the credential works; returns how many items it could see. */
  probe(settings: SignalSettings, secret: Record<string, string>): Promise<number>;
}

const str = (v: unknown, max = 4096) => (typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v ? v : null);
const need = <T>(v: T | null, code: string): T => { if (v === null) throw new Error(code); return v; };
const region = (v: unknown) => (v === "eu" ? "eu" : "us");

export const SIGNAL_DESCRIPTORS: Readonly<Record<SignalProvider, SignalDescriptor>> = Object.freeze({
  argo_cd: {
    label: "Argo CD",
    async parse(i) { return { settings: { baseUrl: await validateArgoCdBaseUrl(String(i.baseUrl ?? "").trim()), project: need(str(i.project, 63), "argocd_project_invalid") }, secret: { token: need(str(i.token), "credentials_required") } }; },
    async probe(s, k) { return (await new ArgoCdClient(s.baseUrl, s.project, { authMode: "bearer", token: k.token }).listApplications()).length; },
  },
  flux: {
    label: "Flux",
    async parse(i) { return { settings: { baseUrl: await validateFluxApiBaseUrl(String(i.baseUrl ?? "").trim()), namespace: need(str(i.namespace, 63), "flux_namespace_invalid") }, secret: { token: need(str(i.token), "credentials_required") } }; },
    async probe(s, k) { return (await new FluxClient(s.baseUrl, s.namespace, { authMode: "bearer", token: k.token }).listKustomizations()).length; },
  },
  pagerduty: {
    label: "PagerDuty",
    async parse(i) { return { settings: { region: region(i.region) }, secret: { token: need(str(i.token, 200), "credentials_required") } }; },
    async probe(s, k) { return (await new PagerDutyReadClient({ token: k.token, region: s.region as "us" | "eu" }).listOpenIncidents()).length; },
  },
  opsgenie: {
    label: "Opsgenie",
    async parse(i) { return { settings: { region: region(i.region) }, secret: { apiKey: need(str(i.apiKey, 64), "credentials_required") } }; },
    async probe(s, k) { return (await new OpsgenieReadClient({ apiKey: k.apiKey, region: s.region as "us" | "eu" }).listOpenAlerts()).length; },
  },
  sentry: {
    label: "Sentry",
    async parse(i) { return { settings: { org: need(str(i.org, 50), "sentry_scope_invalid"), project: need(str(i.project, 50), "sentry_scope_invalid"), region: region(i.region) === "eu" ? "de" : "us" }, secret: { token: need(str(i.token, 200), "credentials_required") } }; },
    async probe(s, k) { return (await new SentryReadClient(s.org, s.project, k.token, s.region as "us" | "de").newIssuesInRelease("v19-connection-check")).length; },
  },
  datadog: {
    label: "Datadog",
    async parse(i) {
      const site = String(i.site ?? "datadoghq.com");
      if (!(DATADOG_SITES as readonly string[]).includes(site)) throw new Error("datadog_site_invalid");
      return { settings: { site, tag: need(str(i.tag, 100), "datadog_tag_invalid") }, secret: { apiKey: need(str(i.apiKey, 64), "credentials_required"), appKey: need(str(i.appKey, 64), "credentials_required") } };
    },
    async probe(s, k) { return (await new DatadogReadClient(s.site as DatadogSite, k.apiKey, k.appKey).monitorsTagged(s.tag)).length; },
  },
  launchdarkly: {
    label: "LaunchDarkly",
    async parse(i) { return { settings: { project: need(str(i.project, 128), "launchdarkly_scope_invalid"), environment: need(str(i.environment, 128), "launchdarkly_scope_invalid") }, secret: { token: need(str(i.token, 200), "credentials_required") } }; },
    async probe(s, k) { return (await new LaunchDarklyReadClient(s.project, s.environment, { token: k.token }).listFlags()).length; },
  },
  unleash: {
    label: "Unleash",
    async parse(i) { return { settings: { baseUrl: await validateUnleashBaseUrl(String(i.baseUrl ?? "").trim()) }, secret: { token: need(str(i.token, 300), "credentials_required") } }; },
    async probe(s, k) { return (await new UnleashReadClient(s.baseUrl, k.token).listFlags()).length; },
  },
});

const PREFIX: Record<SignalProvider, string> = { argo_cd: "argocd_", flux: "flux_", pagerduty: "pagerduty_", opsgenie: "opsgenie_", sentry: "sentry_", datadog: "datadog_", launchdarkly: "launchdarkly_", unleash: "unleash_" };
/** Error codes safe to return; anything else collapses to a generic code so no provider text leaks. */
export function publicSignalError(provider: SignalProvider, error: unknown): string {
  const code = error instanceof Error ? error.message.split(":")[0] : "";
  return code === "credentials_required" || (code.startsWith(PREFIX[provider]) && /^[a-z_]{3,60}$/.test(code)) ? code : `${provider}_connection_failed`;
}
