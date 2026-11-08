/**
 * Download page pipe flow: from installer to a paired, scoped desktop session.
 * Pure data for the shared PipeFlow kit. Wording follows the page's own limits: signing and
 * notarization labels report the release manifest and do not replace local verification.
 */
import type { PipeFlowStage } from "@/components/marketing/pipeKit/PipeFlow";

export const DESKTOP_SETUP_STAGES: readonly PipeFlowStage[] = [
  {
    id: "download",
    title: "Download",
    summary: "Every installer link resolves from the live release manifest.",
    parts: [
      { title: "Your platform", detail: "macOS (Apple Silicon or Intel), Windows or Linux AppImage." },
      { title: "Release record", detail: "The tag, notes and assets for this exact release." },
      { title: "Manifest status", detail: "Whether the release reports itself ready to sign in." },
    ],
    guarantee: "Downloads come from the published release, not a copied link.",
    onFailure: "If the manifest is unavailable, the page says so instead of guessing a file.",
    passesOn: { label: "installer + digest", detail: "The file and the SHA-256 it should match." },
    tone: "sky",
  },
  {
    id: "verify",
    title: "Verify",
    summary: "Check the file before you run it.",
    parts: [
      { title: "SHA-256 digest", detail: "Compare the published digest with your download." },
      { title: "Signature", detail: "Review the detached signature where one is provided." },
      { title: "Signing labels", detail: "Signing and notarization as the manifest reports them." },
    ],
    guarantee: "Labels report the manifest; they don't replace your own check.",
    onFailure: "A digest mismatch means don't install; download again from the release record.",
    passesOn: { label: "verified installer", detail: "A file you have checked against the release." },
    tone: "teal",
  },
  {
    id: "install",
    title: "Install",
    summary: "Install on your workstation like any desktop app.",
    parts: [
      { title: "Local install", detail: "The app runs on your machine." },
      { title: "OS checks", detail: "Your operating system applies its own signing checks." },
      { title: "Updates", detail: "Update trust is release- and platform-specific." },
    ],
    guarantee: "Nothing connects to your providers just by installing.",
    onFailure: "If your OS blocks the app, check the release's signing details first.",
    passesOn: { label: "installed app", detail: "Axiom Agent, ready to sign in." },
    tone: "violet",
  },
  {
    id: "sign_in",
    title: "Sign in",
    summary: "Sign in through your browser, not inside the app.",
    parts: [
      { title: "Browser handoff", detail: "The app opens your browser to sign in." },
      { title: "Scoped session", detail: "The app receives a limited desktop session." },
      { title: "Your workspace", detail: "The session belongs to one Axiom workspace." },
    ],
    guarantee: "Interface visibility doesn't grant authority; the service checks permissions.",
    onFailure: "If sign-in is unavailable, the app stays signed out and does nothing.",
    passesOn: { label: "desktop session", detail: "A scoped, revocable sign-in for this device." },
    tone: "amber",
  },
  {
    id: "first_action",
    title: "Connect and work",
    summary: "Connect providers, then work through governed proposals.",
    parts: [
      { title: "Connect providers", detail: "Authorize each provider with the narrowest scope." },
      { title: "Ask and inspect", detail: "Use the Agent to read and explain your systems." },
      { title: "Propose and review", detail: "Changes become reviewed proposals before anything runs." },
    ],
    guarantee: "Consequential operations stay deliberate and reviewed.",
    onFailure: "Missing access stops a proposal before anything is sent.",
    passesOn: null,
    tone: "emerald",
  },
];
