import {NextRequest} from "next/server";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {GET as azureRoute} from "@/app/api/telemetry/azure-monitor/route";
import {GET as dynatraceRoute} from "@/app/api/telemetry/dynatrace/route";
import {GET as gcpRoute} from "@/app/api/telemetry/gcp-cloud-monitoring/route";
import {GET as newRelicRoute} from "@/app/api/telemetry/new-relic/route";
import {__resetEnvCacheForTest} from "@/lib/config/env";
import {id} from "@/lib/domain/ids";
import {extractPagerDutyOpenIncidents} from "@/lib/incidents/pagerDutyPullExtractor";
import {extractAwsCloudWatchAlarms} from "../awsCloudWatchExtractor";
import {extractAzureMonitorAlerts} from "../azureMonitorPullExtractor";
import {extractDatadogAlertingMonitors} from "../datadogPullExtractor";
import {extractDynatraceProblems} from "../dynatracePullExtractor";
import {extractGcpCloudMonitoringIncidents} from "../gcpCloudMonitoringPullExtractor";
import {extractNewRelicIssues} from "../newRelicPullExtractor";
import {extractSentryUnresolvedIssues} from "../sentryPullExtractor";

const mocks = vi.hoisted(() => ({currentContext: vi.fn()}));
vi.mock("@/lib/auth/currentContext", () => ({currentContext: mocks.currentContext}));

const telemetryWorkspace = id.organization("telemetry-workspace");
const incidentWorkspace = id.organization("incident-workspace");
const unrelatedWorkspace = id.organization("independent-workspace");
const fetcher = vi.fn();
const blocked = {
  mode: "blocked",
  limitations: ["No pull credentials are assigned to this workspace."],
};

describe("process-wide pull credential ownership", () => {
  beforeEach(() => {
    fetcher.mockReset();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("TELEMETRY_PULL_TENANT_ID", telemetryWorkspace);
    vi.stubEnv("INCIDENT_PULL_TENANT_ID", incidentWorkspace);
    vi.stubEnv("SENTRY_PULL_ENABLED", "true");
    vi.stubEnv("SENTRY_AUTH_TOKEN", "fixture");
    vi.stubEnv("SENTRY_ORG", "example");
    vi.stubEnv("SENTRY_BASE_URL", "https://sentry-fixture.invalid");
    vi.stubEnv("PAGERDUTY_PULL_ENABLED", "true");
    vi.stubEnv("PAGERDUTY_API_TOKEN", "fixture");
    __resetEnvCacheForTest();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetEnvCacheForTest();
    mocks.currentContext.mockReset();
  });

  it.each([
    extractAwsCloudWatchAlarms, extractAzureMonitorAlerts, extractDatadogAlertingMonitors,
    extractDynatraceProblems, extractGcpCloudMonitoringIncidents, extractNewRelicIssues,
    extractSentryUnresolvedIssues, extractPagerDutyOpenIncidents,
  ])("blocks $name for a different workspace before transport", async extract => {
    expect(await extract(unrelatedWorkspace)).toMatchObject(blocked);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires explicit ownership and keeps incident and telemetry bindings independent", async () => {
    vi.stubEnv("TELEMETRY_PULL_TENANT_ID", "");
    __resetEnvCacheForTest();
    expect(await extractSentryUnresolvedIssues(telemetryWorkspace)).toMatchObject(blocked);
    expect(await extractPagerDutyOpenIncidents(telemetryWorkspace)).toMatchObject(blocked);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps configured read paths working for the credential owners", async () => {
    fetcher
      .mockResolvedValueOnce(Response.json([{id: "fixture-issue", title: "Example issue"}]))
      .mockResolvedValueOnce(Response.json({incidents: [{id: "fixture-incident", title: "Example incident"}]}));
    expect(await extractSentryUnresolvedIssues(telemetryWorkspace)).toMatchObject({
      mode: "live", signals: [{id: "sentry:fixture-issue"}],
    });
    expect(await extractPagerDutyOpenIncidents(incidentWorkspace)).toMatchObject({
      mode: "live", records: [{externalId: "fixture-incident"}],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["azure-monitor", azureRoute], ["dynatrace", dynatraceRoute],
    ["gcp-cloud-monitoring", gcpRoute], ["new-relic", newRelicRoute],
  ])("uses authenticated workspace identity in the %s direct route", async (path, handler) => {
    const request = new NextRequest("https://local-test.invalid/api/telemetry/" + path);
    mocks.currentContext.mockResolvedValueOnce({isAuthenticated: true});
    expect(await (await handler(request)).json()).toMatchObject({ok: false});
    mocks.currentContext.mockResolvedValueOnce({isAuthenticated: true, organizationId: unrelatedWorkspace});
    const result = await handler(request);
    expect(await result.json()).toMatchObject({ok: true, data: blocked});
    expect(fetcher).not.toHaveBeenCalled();
  });
});
