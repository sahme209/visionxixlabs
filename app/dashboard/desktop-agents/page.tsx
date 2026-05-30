import { HonestEmptyPage } from "@/components/dashboard/HonestEmptyPage";

export const dynamic = "force-dynamic";

export default function DesktopAgentsPage() {
  return (
    <HonestEmptyPage
      kicker="desktop agents"
      title="Paired desktops + delegated runners."
      description="When you pair the Axiom desktop app to your workspace, the trust state + last-seen + paired session count appear here. Nothing on this page is sample data."
      needs={[
        "PairedDesktop rows from the desktop pairing service",
        "Last-seen heartbeat per device",
        "Per-desktop fingerprint + signing key trust state",
      ]}
    />
  );
}
