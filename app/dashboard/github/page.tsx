import { ProviderDrilldown } from "@/components/dashboard/ProviderDrilldown";

export const metadata = { title: "GitHub · Axiom" };

export default function GitHubPage() {
  return <ProviderDrilldown providerId="github" />;
}
