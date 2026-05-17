import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";

export const metadata = { title: "Azure · Axiom" };

export default function AzurePage() {
  return <ProviderDrilldown providerId="azure" />;
}
