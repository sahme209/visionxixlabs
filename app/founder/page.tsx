import { BusinessOverview } from "@/components/founder/BusinessOverview";
import { readBusinessOverview } from "@/lib/founder/founderBusiness";
import { readAutopilotState } from "@/lib/founder/founderAutopilot";

export const dynamic = "force-dynamic";

/** Founder back office landing page. The layout has already checked that the viewer is the founder. */
export default async function FounderHome() {
  const [data, autopilot] = await Promise.all([readBusinessOverview(), readAutopilotState().catch(() => null)]);
  return <BusinessOverview data={data} autopilot={autopilot} />;
}
