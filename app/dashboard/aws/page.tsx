import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";

export const metadata = { title: "AWS · Axiom" };

export default function AwsPage() {
  return <ProviderDrilldown providerId="aws" />;
}
