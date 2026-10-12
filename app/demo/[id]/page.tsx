/**
 * Legacy scenario URLs contain simulations that predate the
 * release-verified desktop demo. Keep inbound links valid without publicly
 * rendering workflows that are not available in the shipped product.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DemoScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect("/demo");
}
