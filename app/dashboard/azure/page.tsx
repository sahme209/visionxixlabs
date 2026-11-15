import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";

export const metadata = { title: "Azure · V19" };

export default function AzurePage() {
  return <ProviderDrilldown providerId="azure" />;
}
