/**
 * /team-of-one — public marketing landing page.
 *
 * Huly.io-flavored visual treatment: animated aurora, cursor-tracking
 * glow, scroll-revealed sections. Selling point: "one platform that
 * does the work of a million-dollar engineering team."
 *
 * Server component shell that hosts client-side animated children.
 */

import type { Metadata } from "next";
import { TeamOfOneClient } from "./TeamOfOneClient";

export const metadata: Metadata = {
  title: "Axiom — the AGI ops platform that replaces an entire IT team",
  description: "Ten specialist agents, twenty-five engineering disciplines, one platform. Three surfaces (web + mobile + desktop). Approval-only-no-execution.",
};

export default function TeamOfOnePage() {
  return <TeamOfOneClient />;
}
