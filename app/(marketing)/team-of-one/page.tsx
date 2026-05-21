/**
 * /team-of-one — public marketing landing page.
 *
 * Huly.io-flavored visual treatment: animated aurora, cursor-tracking
 * glow, scroll-revealed sections. Positioning: an AI-assisted
 * operations platform that amplifies the operator across cloud,
 * DevOps, security, observability, and business operations — with
 * human approval required before any action runs.
 *
 * Server component shell that hosts client-side animated children.
 */

import type { Metadata } from "next";
import { TeamOfOneClient } from "./TeamOfOneClient";

export const metadata: Metadata = {
  title: "Axiom — AI-assisted operations across cloud, DevOps, security, and business",
  description: "An operations platform where AI agents propose, humans approve, and every action is audited. Multi-cloud (AWS / Azure / GCP), web + mobile + desktop surfaces.",
};

export default function TeamOfOnePage() {
  return <TeamOfOneClient />;
}
