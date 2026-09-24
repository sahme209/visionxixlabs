/**
 * CTA map — typed, centralized definition of every primary/secondary/fallback
 * CTA across the product. Single source of truth so the site can't drift
 * back into contact-led primaries.
 *
 * Rule: primary + secondary CTAs are always self-serve. Contact-led CTAs
 * are demoted to "fallback" and only show as small text links unless the
 * surface is explicitly enterprise (procurement, security review, partnership).
 */

import type { CloudProvider } from "@/lib/connectors/interface";

// ---------------------------------------------------------------------------
// CTA types
// ---------------------------------------------------------------------------

export type CtaKind = "self_serve" | "fallback";

/** Where a CTA leads. Used to drive analytics + auditing of CTA quality. */
export type CtaIntent =
  | "sign_up"             // Create an account
  | "connect_cloud"       // Start an AWS/Azure/GCP connection
  | "scan"                // Trigger a scan
  | "open_dashboard"      // Land in dashboard / command center
  | "open_releaseops"     // Land in ReleaseOps command center
  | "view_topology"
  | "view_workflows"
  | "view_memory"
  | "view_plan"           // View execution plan
  | "download_desktop"
  | "read_docs"
  | "view_pricing"
  | "view_security"
  | "explore_demo"        // Sample data / interactive demo
  // Fallback / enterprise paths
  | "contact_enterprise"
  | "contact_security_review"
  | "contact_procurement"
  | "contact_partnership"
  | "contact_support";

export interface Cta {
  /** Stable identifier for analytics. */
  id: string;
  label: string;
  href: string;
  intent: CtaIntent;
  kind: CtaKind;
  /** Optional icon name; consumed by UI by convention. */
  iconHint?: "arrow_right" | "download" | "play" | "book" | "shield";
  /** Optional descriptive subtext. */
  sublabel?: string;
}

export interface CtaSlot {
  /** Surface this CTA applies to. */
  surface: SurfaceKey;
  /** Slot within the surface. */
  slot: "primary" | "secondary" | "tertiary" | "fallback";
  cta: Cta;
}

// ---------------------------------------------------------------------------
// Surface taxonomy
// ---------------------------------------------------------------------------

export type SurfaceKey =
  | "homepage_hero"
  | "homepage_cta"
  | "homepage_multicloud"
  | "operator_landing"
  | "operator_onboarding_provider_pick"
  | "operator_onboarding_aws_setup"
  | "operator_onboarding_azure_preview"
  | "operator_onboarding_gcp_preview"
  | "operator_pricing"
  | "axiom_releaseops_marketing_hero"
  | "axiom_releaseops_marketing_cta"
  | "dashboard_landing"
  | "dashboard_command_center"
  | "dashboard_topology"
  | "dashboard_memory"
  | "dashboard_workflows"
  | "dashboard_releaseops"
  | "download_hero"
  | "download_cta"
  | "docs_overview"
  | "docs_getting_started"
  | "docs_aws_setup"
  | "security_landing"
  | "contact_page";

// ---------------------------------------------------------------------------
// Canonical CTAs — single source of truth
// ---------------------------------------------------------------------------

const CTA_REGISTRY: Record<string, Cta> = {
  start_with_aws: {
    id: "start_with_aws",
    label: "Open the web app",
    href: "/auth/signup?redirect=/dashboard",
    intent: "sign_up",
    kind: "self_serve",
    iconHint: "arrow_right",
    sublabel: "Read-only IAM role · 5 minutes · revoke anytime",
  },
  run_axiom: {
    id: "run_axiom",
    label: "Open the web app",
    href: "/auth/signup?redirect=/dashboard",
    intent: "sign_up",
    kind: "self_serve",
    iconHint: "arrow_right",
  },
  see_in_action: {
    id: "see_in_action",
    label: "SEE IN ACTION",
    href: "/demo",
    intent: "explore_demo",
    kind: "self_serve",
    iconHint: "arrow_right",
  },
  open_command_center: {
    id: "open_command_center",
    label: "Open Command Center",
    href: "/dashboard/command-center",
    intent: "open_dashboard",
    kind: "self_serve",
    iconHint: "arrow_right",
  },
  open_releaseops_cmd: {
    id: "open_releaseops_cmd",
    label: "Open Command Center",
    href: "/dashboard/releaseops",
    intent: "open_releaseops",
    kind: "self_serve",
    iconHint: "arrow_right",
  },
  view_topology: {
    id: "view_topology",
    label: "View topology",
    href: "/dashboard/topology",
    intent: "view_topology",
    kind: "self_serve",
  },
  download_desktop: {
    id: "download_desktop",
    label: "View product access",
    href: "/download",
    intent: "open_dashboard",
    kind: "self_serve",
    iconHint: "download",
  },
  read_aws_setup: {
    id: "read_aws_setup",
    label: "Read setup guide",
    href: "/docs/aws-setup",
    intent: "read_docs",
    kind: "self_serve",
  },
  read_azure_setup: {
    id: "read_azure_setup",
    label: "Read Azure setup",
    href: "/docs/azure-setup",
    intent: "read_docs",
    kind: "self_serve",
  },
  read_gcp_setup: {
    id: "read_gcp_setup",
    label: "Read GCP setup",
    href: "/docs/gcp-setup",
    intent: "read_docs",
    kind: "self_serve",
  },
  read_releaseops_overview: {
    id: "read_releaseops_overview",
    label: "Read setup guide",
    href: "/docs/releaseops",
    intent: "read_docs",
    kind: "self_serve",
  },
  read_security_model: {
    id: "read_security_model",
    label: "View security model",
    href: "/docs/security-model",
    intent: "view_security",
    kind: "self_serve",
    iconHint: "shield",
  },
  read_docs: {
    id: "read_docs",
    label: "Read documentation",
    href: "/docs",
    intent: "read_docs",
    kind: "self_serve",
  },
  view_pricing: {
    id: "view_pricing",
    label: "View pricing",
    href: "/plans",
    intent: "view_pricing",
    kind: "self_serve",
  },
  start_free_trial: {
    id: "start_free_trial",
    label: "Create a workspace",
    href: "/auth/signup?redirect=/dashboard",
    intent: "sign_up",
    kind: "self_serve",
    iconHint: "arrow_right",
  },
  how_it_works: {
    id: "how_it_works",
    label: "How it works",
    href: "/demo",
    intent: "explore_demo",
    kind: "self_serve",
  },
  // Fallback — contact paths only used as tertiary
  contact_enterprise: {
    id: "contact_enterprise",
    label: "Need enterprise help?",
    href: "/contact?topic=enterprise",
    intent: "contact_enterprise",
    kind: "fallback",
  },
  contact_security_review: {
    id: "contact_security_review",
    label: "Request security review",
    href: "/contact?topic=security",
    intent: "contact_security_review",
    kind: "fallback",
  },
  contact_procurement: {
    id: "contact_procurement",
    label: "Procurement support",
    href: "/contact?topic=procurement",
    intent: "contact_procurement",
    kind: "fallback",
  },
  contact_partnership: {
    id: "contact_partnership",
    label: "Partner with us",
    href: "/contact?topic=partnership",
    intent: "contact_partnership",
    kind: "fallback",
  },
  contact_support: {
    id: "contact_support",
    label: "Talk to a human",
    href: "/contact",
    intent: "contact_support",
    kind: "fallback",
  },
};

// ---------------------------------------------------------------------------
// Surface → CTA slot mapping
//
// One row per (surface, slot). Adding a new surface = adding entries here.
// Removing contact-led primary = changing one row, not chasing the codebase.
// ---------------------------------------------------------------------------

const SURFACE_SLOTS: CtaSlot[] = [
  // Homepage
  { surface: "homepage_hero",      slot: "primary",   cta: CTA_REGISTRY.run_axiom },
  { surface: "homepage_hero",      slot: "secondary", cta: CTA_REGISTRY.how_it_works },
  { surface: "homepage_cta",       slot: "primary",   cta: CTA_REGISTRY.start_with_aws },
  { surface: "homepage_cta",       slot: "secondary", cta: CTA_REGISTRY.read_docs },
  { surface: "homepage_cta",       slot: "fallback",  cta: CTA_REGISTRY.contact_enterprise },

  // Operator landing
  { surface: "operator_landing",   slot: "primary",   cta: CTA_REGISTRY.start_with_aws },
  { surface: "operator_landing",   slot: "secondary", cta: CTA_REGISTRY.view_pricing },

  // Onboarding
  { surface: "operator_onboarding_provider_pick", slot: "primary",   cta: CTA_REGISTRY.start_with_aws },
  { surface: "operator_onboarding_provider_pick", slot: "secondary", cta: CTA_REGISTRY.read_aws_setup },
  { surface: "operator_onboarding_aws_setup",     slot: "primary",   cta: CTA_REGISTRY.read_aws_setup },
  { surface: "operator_onboarding_aws_setup",     slot: "secondary", cta: CTA_REGISTRY.read_security_model },
  { surface: "operator_onboarding_azure_preview", slot: "primary",   cta: CTA_REGISTRY.read_azure_setup },
  { surface: "operator_onboarding_azure_preview", slot: "fallback",  cta: CTA_REGISTRY.contact_enterprise },
  { surface: "operator_onboarding_gcp_preview",   slot: "primary",   cta: CTA_REGISTRY.read_gcp_setup },
  { surface: "operator_onboarding_gcp_preview",   slot: "fallback",  cta: CTA_REGISTRY.contact_enterprise },

  // ReleaseOps marketing
  { surface: "axiom_releaseops_marketing_hero", slot: "primary",   cta: CTA_REGISTRY.open_releaseops_cmd },
  { surface: "axiom_releaseops_marketing_hero", slot: "secondary", cta: CTA_REGISTRY.read_releaseops_overview },
  { surface: "axiom_releaseops_marketing_cta",  slot: "primary",   cta: CTA_REGISTRY.open_releaseops_cmd },
  { surface: "axiom_releaseops_marketing_cta",  slot: "secondary", cta: CTA_REGISTRY.read_releaseops_overview },
  { surface: "axiom_releaseops_marketing_cta",  slot: "fallback",  cta: CTA_REGISTRY.contact_enterprise },

  // Dashboard
  { surface: "dashboard_landing",        slot: "primary",   cta: CTA_REGISTRY.open_command_center },
  { surface: "dashboard_landing",        slot: "secondary", cta: CTA_REGISTRY.view_topology },
  { surface: "dashboard_command_center", slot: "primary",   cta: CTA_REGISTRY.start_with_aws },
  { surface: "dashboard_topology",       slot: "primary",   cta: CTA_REGISTRY.start_with_aws },
  { surface: "dashboard_memory",         slot: "primary",   cta: CTA_REGISTRY.open_command_center },
  { surface: "dashboard_workflows",      slot: "primary",   cta: CTA_REGISTRY.start_with_aws },
  { surface: "dashboard_releaseops",     slot: "primary",   cta: CTA_REGISTRY.download_desktop },

  // Download
  { surface: "download_hero", slot: "primary",   cta: CTA_REGISTRY.download_desktop },
  { surface: "download_hero", slot: "secondary", cta: CTA_REGISTRY.read_docs },
  { surface: "download_cta",  slot: "primary",   cta: CTA_REGISTRY.download_desktop },
  { surface: "download_cta",  slot: "secondary", cta: CTA_REGISTRY.open_command_center },

  // Docs
  { surface: "docs_overview",        slot: "primary",   cta: CTA_REGISTRY.start_with_aws },
  { surface: "docs_overview",        slot: "secondary", cta: CTA_REGISTRY.read_docs },
  { surface: "docs_getting_started", slot: "primary",   cta: CTA_REGISTRY.start_with_aws },
  { surface: "docs_aws_setup",       slot: "primary",   cta: CTA_REGISTRY.start_with_aws },

  // Security
  { surface: "security_landing", slot: "primary",   cta: CTA_REGISTRY.read_security_model },
  { surface: "security_landing", slot: "fallback",  cta: CTA_REGISTRY.contact_security_review },

  // Contact (still useful, but framed as fallback paths)
  { surface: "contact_page", slot: "primary",   cta: CTA_REGISTRY.contact_enterprise },
  { surface: "contact_page", slot: "secondary", cta: CTA_REGISTRY.contact_security_review },
  { surface: "contact_page", slot: "tertiary",  cta: CTA_REGISTRY.contact_partnership },

  // Pricing
  { surface: "operator_pricing", slot: "primary",   cta: CTA_REGISTRY.start_free_trial },
  { surface: "operator_pricing", slot: "fallback",  cta: CTA_REGISTRY.contact_procurement },
];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Return all CTAs for a surface in slot order. */
export function ctasForSurface(surface: SurfaceKey): CtaSlot[] {
  const order: CtaSlot["slot"][] = ["primary", "secondary", "tertiary", "fallback"];
  return SURFACE_SLOTS
    .filter((row) => row.surface === surface)
    .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
}

/** Return the primary CTA for a surface, or undefined. */
export function primaryCta(surface: SurfaceKey): Cta | undefined {
  return SURFACE_SLOTS.find((row) => row.surface === surface && row.slot === "primary")?.cta;
}

/** Return the secondary CTA for a surface, or undefined. */
export function secondaryCta(surface: SurfaceKey): Cta | undefined {
  return SURFACE_SLOTS.find((row) => row.surface === surface && row.slot === "secondary")?.cta;
}

/** Return the fallback (typically contact) CTA for a surface, or undefined. */
export function fallbackCta(surface: SurfaceKey): Cta | undefined {
  return SURFACE_SLOTS.find((row) => row.surface === surface && row.slot === "fallback")?.cta;
}

/** Provider-aware setup CTA — picks the right doc setup link by provider. */
export function providerSetupCta(provider: CloudProvider): Cta {
  if (provider === "aws") return CTA_REGISTRY.read_aws_setup;
  if (provider === "azure") return CTA_REGISTRY.read_azure_setup;
  return CTA_REGISTRY.read_gcp_setup;
}

/** Audit helper — flag any surface where the primary CTA is contact-led. */
export function audit(): { surface: SurfaceKey; problem: string }[] {
  const out: { surface: SurfaceKey; problem: string }[] = [];
  for (const row of SURFACE_SLOTS) {
    if (row.slot === "primary" && row.cta.kind !== "self_serve") {
      out.push({ surface: row.surface, problem: `Primary CTA "${row.cta.label}" is contact-led; should be self-serve.` });
    }
  }
  return out;
}

export { CTA_REGISTRY };
