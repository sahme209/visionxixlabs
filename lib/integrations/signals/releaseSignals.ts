import "server-only";

import { PagerDutyReadClient } from "@/lib/integrations/pagerduty/pagerDutyReadClient";
import { OpsgenieReadClient } from "@/lib/integrations/opsgenie/opsgenieReadClient";
import { SentryReadClient } from "@/lib/integrations/sentry/sentryReadClient";
import { DatadogReadClient, summarizeMonitors, type DatadogSite } from "@/lib/integrations/datadog/datadogReadClient";
import { LaunchDarklyReadClient, staleTemporaryFlags } from "@/lib/integrations/launchdarkly/launchDarklyReadClient";
import { UnleashReadClient } from "@/lib/integrations/unleash/unleashReadClient";
import { verifyRelease, type Verification } from "@/lib/releaseops/releaseVerification";
import type { SignalProvider } from "./signalProviders";

/**
 * Reads every connected release signal for one release, in parallel and independently: a provider that
 * is not connected or fails is reported as unavailable and never blocks the others. Read-only.
 */
export type Loader = (provider: SignalProvider) => Promise<{ settings: Record<string, string>; secret: Record<string, string> }>;
export interface ReleaseSignals {
  release: string;
  incidents: { pagerduty: number | null; opsgenie: number | null };
  newIssues: Array<{ title: string; level: string | null; count: number | null; url: string | null }> | null;
  monitors: { alerting: number; warning: number; ok: number; noData: number } | null;
  staleFlags: string[] | null;
  unavailable: SignalProvider[];
  verification: Verification;
}

export async function readReleaseSignals(load: Loader, input: { release: string; verifyChecks: Array<{ key: string; status: string }> | null; now: Date }): Promise<ReleaseSignals> {
  const unavailable: SignalProvider[] = [];
  const attempt = async <T>(provider: SignalProvider, read: (c: { settings: Record<string, string>; secret: Record<string, string> }) => Promise<T>): Promise<T | null> => {
    try { return await read(await load(provider)); } catch { unavailable.push(provider); return null; }
  };
  const [pd, og, issues, monitors, flags, unleashStale] = await Promise.all([
    attempt("pagerduty", async (c) => (await new PagerDutyReadClient({ token: c.secret.token, region: c.settings.region as "us" | "eu" }).listOpenIncidents()).length),
    attempt("opsgenie", async (c) => (await new OpsgenieReadClient({ apiKey: c.secret.apiKey, region: c.settings.region as "us" | "eu" }).listOpenAlerts()).length),
    attempt("sentry", async (c) => (await new SentryReadClient(c.settings.org, c.settings.project, c.secret.token, c.settings.region as "us" | "de").newIssuesInRelease(input.release)).map((i) => ({ title: i.title, level: i.level, count: i.count, url: i.url }))),
    attempt("datadog", async (c) => summarizeMonitors(await new DatadogReadClient(c.settings.site as DatadogSite, c.secret.apiKey, c.secret.appKey).monitorsTagged(c.settings.tag))),
    attempt("launchdarkly", async (c) => staleTemporaryFlags(await new LaunchDarklyReadClient(c.settings.project, c.settings.environment, { token: c.secret.token }).listFlags(), input.now).map((f) => f.key)),
    attempt("unleash", async (c) => (await new UnleashReadClient(c.settings.baseUrl, c.secret.token).listFlags()).filter((f) => f.stale && f.enabled).map((f) => f.name)),
  ]);
  return {
    release: input.release,
    incidents: { pagerduty: pd, opsgenie: og },
    newIssues: issues,
    monitors,
    staleFlags: flags === null && unleashStale === null ? null : [...(flags ?? []), ...(unleashStale ?? [])],
    unavailable: unavailable.sort(),
    verification: verifyRelease({ newIssues: issues, monitors, verifyChecks: input.verifyChecks }),
  };
}
