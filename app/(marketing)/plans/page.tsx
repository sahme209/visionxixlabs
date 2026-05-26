import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — VisionXIXLabs",
  description: "Custom pricing based on your actual cloud usage. Connect AWS, Azure, or GCP for a real estimate. Cloud bill never marked up.",
};

export default function PricingPage() {
  return <PricingClient />;
}
