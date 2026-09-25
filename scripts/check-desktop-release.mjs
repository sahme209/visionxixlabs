import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopPackage = readJson("desktop/package.json");
const tauriConfig = readJson("desktop/src-tauri/tauri.conf.json");
const workflow = readText(".github/workflows/desktop-release.yml");
const releaseManifest = readText("lib/desktop/releaseManifest.ts");
const connectionBanner = readText("desktop/src/components/ConnectionBanner.tsx");
const footer = readText("components/Footer.tsx");
const demoLanding = readText("app/demo/page.tsx");

const errors = [];

if (desktopPackage.version !== tauriConfig.version) {
  errors.push(`desktop/package.json version ${desktopPackage.version} does not match tauri.conf.json version ${tauriConfig.version}`);
}
if (desktopPackage.name !== "axiom-desktop") {
  errors.push(`unexpected desktop package name: ${desktopPackage.name}`);
}
if (tauriConfig.productName !== "Axiom Agent") {
  errors.push(`customer-facing product name must remain "Axiom Agent", found: ${tauriConfig.productName}`);
}
if (tauriConfig.identifier !== "com.visionxixlabs.axiom") {
  errors.push(`unexpected desktop bundle identifier: ${tauriConfig.identifier}`);
}
if (!workflow.includes("desktop-v*")) {
  errors.push("desktop release workflow no longer listens for desktop-v* tags");
}
if (!workflow.includes("if-no-files-found: error")) {
  errors.push("desktop release workflow must fail when an expected platform produces no installer");
}
if (!releaseManifest.includes('"sahme209"') || !releaseManifest.includes('"axiom-releases"')) {
  errors.push("website release manifest no longer defaults to the public Axiom Agent release repository");
}
if (!releaseManifest.includes("artifact-signed: true") || !releaseManifest.includes("artifact-notarized: true")) {
  errors.push("release manifest must require machine-readable signing attestations");
}
if (!connectionBanner.includes("navigator.onLine") || !connectionBanner.includes('addEventListener("offline"')) {
  errors.push("desktop connectivity banner must respond to the workstation's real online/offline state");
}
if (connectionBanner.includes('connection: "online"')) {
  errors.push("desktop connectivity banner must not hard-code a healthy connection");
}
if (!footer.includes("We also build iOS applications.")) {
  errors.push("website footer must retain the approved secondary iOS capability mention");
}
if (footer.includes("apps.apple.com")) {
  errors.push("App Store link must remain disabled until the developer-page URL is supplied and verified");
}
if (demoLanding.includes("Create a web workspace") || demoLanding.includes("/auth/signup")) {
  errors.push("sandbox must direct customers to the downloadable app, not advertise a browser product");
}
if (!demoLanding.includes('href="/download"') || !demoLanding.includes("Download the desktop app")) {
  errors.push("sandbox must provide a clear path to the downloadable app");
}

if (errors.length > 0) {
  console.error("Desktop release alignment failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Desktop release alignment passed: Axiom Agent v${desktopPackage.version}`);

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}
