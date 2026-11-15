"use client";
import { useRef } from "react";
import type { PublicCatalogEntry } from "@/lib/integrations/publicIntegrationCatalog";
import { IntegrationCatalogLogo } from "./IntegrationCatalogLogo";
import { usePreviewSequence } from "./usePreviewSequence";

/** Decorative overview; complete names, status and limits remain in the catalog. */
export function IntegrationConnectionsScene({ entries }: { entries: PublicCatalogEntry[] }) {
  const scene = useRef<HTMLDivElement>(null);
  const reveal = usePreviewSequence(scene);
  const midpoint = Math.ceil(entries.length / 2);
  return <div ref={scene} className="integration-connections-scene" aria-hidden="true" data-preview-active={reveal.active}>
    {[entries.slice(0, midpoint), entries.slice(midpoint)].map((row, index) =>
      <div key={index} className="integration-logo-track" style={{ transform: `translateX(${(1 - reveal.fraction) * (index === 0 ? -64 : 64)}px)` }}>
        {row.map(entry => <div key={entry.id} className="integration-logo-tile"><IntegrationCatalogLogo id={entry.id} /><span>{entry.name}</span></div>)}
      </div>)}
  </div>;
}
