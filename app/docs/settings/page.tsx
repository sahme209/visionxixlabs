import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = { title: "Settings and sessions — Axiom Documentation", description: "Change your display name and review or revoke your paired desktop sessions.", alternates: { canonical: "/docs/settings" } };
export default function SettingsGuide() {
 return <>
  <DocHeader kicker="Account · Settings and sessions" title="Keep your profile and devices under control." summary="Control → Settings & sessions contains Profile, Security and Sessions. Browser sign-in, workspace membership and paired desktop access are distinct." />
  <DocSection id="profile" kicker="01" title="Change your display name">
   <p>Open <a href="/control/settings">Settings &amp; sessions → Profile</a>. Edit <em>Display name</em>, then choose <em>Save profile</em>. Names must contain 1–80 characters; the server trims surrounding whitespace and normalizes repeated spaces. This changes your own account name, not the workspace name.</p>
   <p>The profile form cannot change your sign-in email or workspace permissions. If saving is not confirmed, refresh to inspect the saved name before trying again; a failed response does not prove that the change was rolled back.</p>
  </DocSection>
  <DocSection id="security" kicker="02" title="Understand the Security tab">
   <p><a href="/control/settings?section=security">Security</a> shows the sign-in email and browser-session status. It is not a password, MFA or role-management form. Use <a href="/docs/members">Members and roles</a> for workspace access. Signing out ends the browser session; paired desktop sessions remain independent.</p>
  </DocSection>
  <DocSection id="sessions" kicker="03" title="Review and revoke a paired device">
   <p>Open <a href="/control/settings?section=sessions">Sessions</a>. Axiom lists active pairings belonging to your account in the current workspace, with device label, platform, app version when available and last-seen time. It does not show bearer tokens or provider credentials. An unavailable list is not proof that no devices exist.</p>
   <p>Choose <em>Revoke device</em>, check the named device in the confirmation and confirm. The selected pairing loses access to protected APIs; this does not sign out your browser or revoke other devices. If the result is unconfirmed, refresh the session list before retrying.</p>
   <Callout variant="warning" title="Revocation is not a remote wipe">This revokes the pairing. It does not uninstall the app, erase local files, revoke an independent provider credential or prove that earlier work was cancelled.</Callout>
  </DocSection>
  <DocSection id="desktop" kicker="04" title="Desktop settings have a different scope">
   <p>This guide describes browser account settings. The desktop Agent has its own settings and saved session. Use the <a href="/docs/desktop-install">desktop installation guide</a> for installation and pairing, and confirm the active account and workspace in the app before acting.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/usage-billing",label:"Usage and billing"}} next={{href:"/docs/troubleshooting",label:"Troubleshooting"}} />
 </>;
}
