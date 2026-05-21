import type { Metadata } from "next";
import { FaqClient } from "./FaqClient";

export const metadata: Metadata = {
  title: "FAQ — Axiom",
  description: "Honest answers to the questions a serious buyer asks first: kill switch, lock-in, accountability, data residency, cost predictability.",
};

export default function FaqPage() {
  return <FaqClient />;
}
