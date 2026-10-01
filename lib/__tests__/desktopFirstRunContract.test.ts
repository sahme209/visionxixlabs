import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("desktop first-run contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requires server verification before mounting an authenticated workspace", () => {
    const app = readFileSync(join(root, "desktop/src/App.tsx"), "utf8");
    const client = readFileSync(join(root, "desktop/src/lib/desktopClient.ts"), "utf8");
    expect(app).toContain('"access_required"');
    expect(app).toContain("desktopClient.verifyCurrentCredential()");
    expect(app).toContain("verified.data.access.allowed");
    expect(app).toContain("<DesktopAccessRequiredView");
    expect(client).toContain('>("/api/desktop/access")');
    expect(app.indexOf('if (authState === "checking")')).toBeLessThan(app.indexOf("<AuthenticatedWorkspace"));
  });

  it("separates verified identity from paid workspace access and enforces the gate server-side", () => {
    const accessPolicy = readFileSync(join(root, "lib/desktop/desktopCommercialAccessPolicy.ts"), "utf8");
    const accessRoute = readFileSync(join(root, "app/api/desktop/access/route.ts"), "utf8");
    const resolver = readFileSync(join(root, "lib/desktop/resolveRequestDesktopSession.ts"), "utf8");
    const apiKeyAuth = readFileSync(join(root, "lib/security/authenticateApiKey.ts"), "utf8");
    const stateRoute = readFileSync(join(root, "app/api/desktop/state/route.ts"), "utf8");
    expect(accessPolicy).toContain('plan.status === "active"');
    expect(accessPolicy).toContain('plan.tier !== "trial"');
    expect(accessPolicy).toContain('code: "payment_past_due"');
    expect(accessRoute).toContain("requireActiveAccess: false");
    expect(resolver).toContain("options.requireActiveAccess !== false");
    expect(resolver).toContain("if (!access.allowed) return undefined");
    expect(apiKeyAuth).toContain('billing.status !== "active"');
    expect(apiKeyAuth).toContain('reason: "commercial_access_required"');
    expect(stateRoute).toContain("{ status: 402 }");
  });

  it("binds account creation to a live desktop request without granting a free plan", () => {
    const signupRoute = readFileSync(join(root, "app/api/auth/signup/route.ts"), "utf8");
    const signupPage = readFileSync(join(root, "app/auth/signup/page.tsx"), "utf8");
    expect(signupRoute).toContain("desktopPairingChallengeRecord.findUnique");
    expect(signupRoute).toContain("acceptedTerms !== true");
    expect(signupRoute).toContain("password.length < 12");
    expect(signupRoute).not.toContain('plan: "starter"');
    expect(signupPage).not.toContain("No credit card required");
    expect(signupPage).not.toContain("What you get");
    expect(signupPage).toContain("paid workspace entitlement");
  });

  it("fails public distribution closed when the production desktop data plane is unavailable", () => {
    const readiness = readFileSync(join(root, "lib/desktop/desktopRuntimeReadiness.ts"), "utf8");
    const downloadRoute = readFileSync(join(root, "app/api/desktop/download/route.ts"), "utf8");
    const manifestRoute = readFileSync(join(root, "app/api/desktop/release-manifest/route.ts"), "utf8");
    const previewPage = readFileSync(join(root, "app/download/preview/page.tsx"), "utf8");
    expect(readiness).toContain("desktopPairingChallengeRecord.findFirst");
    expect(readiness).toContain("tenantBillingPlan.findFirst");
    expect(readiness).toContain("tauriDeploymentRequest.findFirst");
    expect(readiness).toContain("ready: false");
    expect(downloadRoute).toContain('status: "temporarily_unavailable"');
    expect(downloadRoute).toContain("{ status: 503 }");
    expect(manifestRoute).toContain("runtimeReady: runtime.ready");
    expect(previewPage).toContain("readDesktopRuntimeReadiness");
    expect(previewPage).toContain('redirect("/download?status=recovered")');
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
    expect(consentClient).toContain("Axiom Agent is authorized");
    expect(consentClient).toContain("axiom-agent://auth/complete");
    expect(consentClient).not.toContain("Desktop connected");
    expect(statusRoute).toContain("consumedAt: null");
    expect(statusRoute).toContain('status: "consumed"');
  });

  it("offers distinct sign-in and account-creation paths and returns to the native app", () => {
    const signIn = readFileSync(join(root, "desktop/src/views/DesktopSignInView.tsx"), "utf8");
    const pairing = readFileSync(join(root, "desktop/src/lib/desktopPairing.ts"), "utf8");
    const startRoute = readFileSync(join(root, "app/api/desktop/pair/start/route.ts"), "utf8");
    const connectPage = readFileSync(join(root, "app/desktop/connect/page.tsx"), "utf8");
    const tauriConfig = readFileSync(join(root, "desktop/src-tauri/tauri.conf.json"), "utf8");
    expect(signIn).toContain('continueInBrowser("sign_in")');
    expect(signIn).toContain('continueInBrowser("sign_up")');
    expect(signIn).toContain("cancelBrowserSignIn");
    expect(pairing).toContain("signal?: AbortSignal");
    expect(pairing).toContain("intent: DesktopAuthIntent");
    expect(pairing).toContain("deviceFingerprint: fingerprint");
    const statusRoute = readFileSync(join(root, "app/api/desktop/pair/status/route.ts"), "utf8");
    expect(statusRoute).toContain('requireString(body.deviceFingerprint, "deviceFingerprint"');
    expect(statusRoute).toContain("record.deviceFingerprint !== deviceFingerprint");
    expect(startRoute).toContain('INTENTS = new Set(["sign_in", "sign_up"])');
    expect(connectPage).toContain('/auth/signup?redirect=');
    expect(connectPage).toContain('/auth/signin?callbackUrl=');
    expect(tauriConfig).toContain('"axiom-agent"');
  });

  it("shows account providers only when the identity service actually configures them", () => {
    const signupPage = readFileSync(join(root, "app/auth/signup/page.tsx"), "utf8");
    expect(signupPage).toContain("getProviders()");
    expect(signupPage).toContain("enabledProviders.google");
    expect(signupPage).toContain("enabledProviders.github");
    expect(signupPage).toContain("enabledProviders?.[provider] !== true");
  });

  it("does not expose legacy customer credential and scan controls in Settings", () => {
    const settings = readFileSync(join(root, "desktop/src/views/SettingsView.tsx"), "utf8");
    expect(settings).toContain("Account & session");
    expect(settings).toContain("Plan & billing");
    expect(settings).toContain("Repositories & triggers");
    expect(settings).toContain("A return from Checkout does not grant access by itself");
    expect(settings).not.toContain("Paste desktop pairing JSON");
    expect(settings).not.toContain("Save API key");
    expect(settings).not.toContain("Default provider");
    expect(settings).not.toContain("Scan on launch");
  });

  it("opens billing through a bearer-authenticated desktop portal session", () => {
    const settings = readFileSync(join(root, "desktop/src/views/SettingsView.tsx"), "utf8");
    const accessWall = readFileSync(join(root, "desktop/src/views/DesktopAccessRequiredView.tsx"), "utf8");
    const client = readFileSync(join(root, "desktop/src/lib/desktopClient.ts"), "utf8");
    const app = readFileSync(join(root, "desktop/src/App.tsx"), "utf8");
    const portal = readFileSync(join(root, "app/api/desktop/billing/portal/route.ts"), "utf8");
    const returned = readFileSync(join(root, "app/desktop/billing/return/page.tsx"), "utf8");
    expect(settings).toContain("desktopClient.desktopBillingPortal()");
    expect(settings).not.toContain("/dashboard/billing");
    expect(accessWall).toContain('identity.access.code === "payment_past_due"');
    expect(accessWall).toContain("desktopClient.desktopBillingPortal()");
    expect(client).toContain('this.post("/api/desktop/billing/portal", {})');
    expect(portal).toContain("resolveRequestDesktopSession");
    expect(portal).toContain("requireActiveAccess: false");
    expect(portal).toContain('principal.credentialKind !== "desktop_session"');
    expect(portal).toContain("createBillingPortalSession");
    expect(portal).toContain("billing_customer_missing");
    expect(returned).toContain("axiom-agent://billing/complete");
    expect(returned).toContain("does not grant access by itself");
    expect(app).toContain('window.addEventListener("focus", verifyAfterBrowserReturn)');
  });

  it("gates optional website measurement behind an explicit privacy choice", () => {
    const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
    const consent = readFileSync(join(root, "components/PrivacyConsent.tsx"), "utf8");
    expect(layout).toContain("<PrivacyConsent />");
    expect(layout).not.toContain("<Analytics />");
    expect(consent).toContain('consent === "accepted" && <Analytics />');
    expect(consent).toContain("Essential only");
    expect(consent).toContain("Accept optional");
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
    expect(app).toContain('useState<CustomerView>("deployment-requests")');
    expect(sidebar).toContain('import type { CustomerView } from "../App"');
    expect(app).toContain("<DeploymentRequestsView />");
    expect(app).not.toContain('from "./lib/mockData"');
    expect(existsSync(join(root, "desktop/src/lib/mockData.ts"))).toBe(false);
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
