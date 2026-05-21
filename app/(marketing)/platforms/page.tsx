import type { Metadata } from "next";
import { PlatformsClient } from "./PlatformsClient";

export const metadata: Metadata = {
  title: "Platforms — Axiom",
  description: "Web, mobile (iOS + Android), and desktop (macOS + Windows + Linux). Same safety contract on every surface.",
};

export default function PlatformsPage() {
  return <PlatformsClient />;
}
