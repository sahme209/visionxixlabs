/**
 * Website Builder — design spec JSON system.
 * Structured UI schema for real preview rendering (not markdown).
 */

export type DesignSpec = {
  siteName: string;
  designLanguage: string;
  colorPalette: { primary: string; secondary: string; accent: string };
  layout: "bento" | "zigzag" | "split" | "grid" | "editorial";
  visualStyle: "minimal" | "bold" | "glassmorphism" | "editorial" | "corporate";
  sections: UISection[];
  meta?: {
    keywords?: string[];
    title?: string;
    description?: string;
  };
};

export type UISection = {
  id: string;
  name: string;
  type: "hero" | "services" | "about" | "testimonials" | "faq" | "contact" | "custom";
  props: Record<string, unknown>;
  /** Optional plugin IDs attached to this section */
  plugins?: string[];
};

/** Map from design spec to renderable schema — used for iframe preview. */
export function designSpecToUISchema(spec: DesignSpec): { html: string; schema: UISection[] } {
  return {
    html: "", // Populated by builder render; fullPageHtml from plan API
    schema: spec.sections,
  };
}
