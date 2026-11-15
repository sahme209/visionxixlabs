import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";

export const metadata = { title: "GCP · V19" };

export default function GcpPage() {
  return <ProviderDrilldown providerId="gcp" />;
}
