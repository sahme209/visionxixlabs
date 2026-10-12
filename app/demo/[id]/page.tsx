/**
 * Legacy scenario URLs contain simulations that predate the
 * release-verified desktop demo. Keep inbound links valid without publicly
 * rendering workflows that are not available in the shipped product.
 */

import { notFound, redirect } from "next/navigation";
import { isDemoScenarioId } from "@/lib/demo/demoScenarios";

export const dynamic = "force-dynamic";

export default async function DemoScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isDemoScenarioId(id)) {
    notFound();
  }
  redirect("/demo");
}
