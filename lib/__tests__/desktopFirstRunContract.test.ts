import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("desktop first-run contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires server verification before mounting an authenticated workspace", () => {
    const app = readFileSync(join(root, "desktop/src/App.tsx"), "utf8");
    expect(app).toContain('useState<"checking" | "authenticated" | "unauthenticated">("checking")');
    expect(app).toContain("desktopClient.verifyCurrentCredential()");
    expect(app.indexOf('if (authState === "checking")')).toBeLessThan(app.indexOf("<AuthenticatedWorkspace"));
  });

  it("keeps browser pairing durable, expiring, and one-time", () => {
    const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
    const startRoute = readFileSync(join(root, "app/api/desktop/pair/start/route.ts"), "utf8");
    const statusRoute = readFileSync(join(root, "app/api/desktop/pair/status/route.ts"), "utf8");
    const consentPage = readFileSync(join(root, "app/desktop/connect/page.tsx"), "utf8");
    const consentClient = readFileSync(join(root, "app/desktop/connect/PairDesktopClient.tsx"), "utf8");
    expect(schema).toContain("model DesktopPairingChallengeRecord");
    expect(schema).toContain("expiresAt");
    expect(schema).toContain("consumedAt");
    expect(startRoute).toContain('new URL("/desktop/connect"');
    expect(consentPage).toContain("App version");
    expect(consentPage).toContain("Request expires");
    expect(consentClient).toContain("Desktop approved");
    expect(consentClient).not.toContain("Desktop connected");
    expect(statusRoute).toContain("consumedAt: null");
    expect(statusRoute).toContain('status: "consumed"');
  });

  it("routes connector setup through the bearer-authenticated desktop client", () => {
    const view = readFileSync(join(root, "desktop/src/views/ConnectorSetupView.tsx"), "utf8");
    const enrollment = readFileSync(join(root, "desktop/src/views/ConnectorsView.tsx"), "utf8");
    expect(view).toContain("desktopClient.v1ConnectorSetupDigest");
    expect(view).not.toContain('fetch("/api/dashboard/connector-setup-digest"');
    expect(view).toContain('onNavigate("connectors")');
    expect(view.toLowerCase()).toContain("no change was made");
    expect(enrollment).toContain("No secret fields enabled");
    expect(enrollment).not.toContain("client_secret");
    expect(enrollment).not.toContain("service_account_key");
  });

  it("fails closed for webview requests outside the product API", () => {
    const transport = readFileSync(join(root, "desktop/src/lib/desktopTransport.ts"), "utf8");
    const config = readFileSync(join(root, "desktop/src-tauri/tauri.conf.json"), "utf8");
    expect(transport).toContain("blocked a request outside the approved product API origin");
    expect(config).toContain("https://visionxixlabs.com");
    expect(config).not.toContain("connect-src 'self' ipc: http://ipc.localhost https:;");
  });

  it("ships only the verified deployment-request journey in customer navigation", () => {
    const app = readFileSync(join(root, "desktop/src/App.tsx"), "utf8");
    const sidebar = readFileSync(join(root, "desktop/src/components/Sidebar.tsx"), "utf8");
    expect(app).toContain('useState<View>("deployment-requests")');
    expect(app).toContain("<DeploymentRequestsView />");
    expect(app).not.toContain('from "./lib/mockData"');
    expect(app).not.toContain("<GitHubAppView");
    expect(app).not.toContain("<AgiCockpitView");
    expect(app).not.toContain("<BillingView");
    expect(sidebar).toContain("Requests & playbooks");
    for (const hiddenLabel of ["AGI cockpit", "GitHub App", "Billing & usage", "Simulations", "Connector health"]) {
      expect(sidebar).not.toContain(hiddenLabel);
    }
  });

  it("does not expose desktop sample mode and accepts both verified credential kinds for deployment requests", () => {
    const signIn = readFileSync(join(root, "desktop/src/views/DesktopSignInView.tsx"), "utf8");
    const resolver = readFileSync(join(root, "lib/desktop/resolveRequestDesktopSession.ts"), "utf8");
    expect(signIn).not.toContain("onPreview");
    expect(signIn).toContain("never substitutes sample records");
    expect(resolver).toContain('token.startsWith("vxlk_")');
    expect(resolver).toContain('credentialKind: "api_key"');
    expect(resolver).toContain('credentialKind: "desktop_session"');
  });

  it("guides intake through validated stages without removing governance controls", () => {
    const intake = readFileSync(join(root, "desktop/src/views/DeploymentRequestsView.tsx"), "utf8");
    expect(intake).toContain('["Window", "Scope", "Execution", "Validation", "Recovery"]');
    expect(intake).toContain("validateStep(step, draft)");
    expect(intake).toContain("Complete ${field} before continuing.");
    expect(intake).toContain("Exact technical production validation");
    expect(intake).toContain("Exact rollback instruction");
    expect(intake).toContain("Source evidence identifier");
    expect(intake).toContain("It does not deploy.");
  });

  it("restricts the native transport to the product API allowlist", () => {
    const transport = readFileSync(join(root, "desktop/src-tauri/src/http.rs"), "utf8");
    expect(transport).toContain('const API_ORIGIN: &str = "https://visionxixlabs.com"');
    expect(transport).toContain('path.starts_with("/api/")');
    expect(transport).toContain("redirect(reqwest::redirect::Policy::none())");
    expect(transport).toContain('"authorization"');
  });
});
