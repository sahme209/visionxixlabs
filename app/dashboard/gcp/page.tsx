import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";

export const metadata = { title: "GCP · Axiom" };

export default function GcpPage() {
  return <ProviderDrilldown providerId="gcp" />;
}
