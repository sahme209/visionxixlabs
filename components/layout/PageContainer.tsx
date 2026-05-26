/**
 * PageContainer — canonical width wrapper.
 *
 * Before this existed, every page rolled its own max-width. The audit
 * found 104 different breakpoints across 201 files: max-w-2xl,
 * max-w-3xl, max-w-4xl, max-w-5xl, max-w-6xl, max-w-7xl,
 * max-w-screen-2xl, max-w-[1200px], max-w-[1000px], max-w-[18ch], etc.
 * Navigation was 1280px wide while Footer was 1152px while the
 * /plans page was 896px. A user clicking through marketing → /plans
 * → /dashboard saw three different widths in a row.
 *
 * This component is the single source of truth. Five variants. Use them.
 *
 *   chrome   — Navigation, Footer, top-level fixed bars. 1280px.
 *   wide     — Marketing hero sections that want to feel expansive. 1280px.
 *   content  — DEFAULT marketing page body. 1152px. Sits in the
 *              "1200-1280" band the design spec calls for.
 *   prose    — Long-form readable text (FAQ, docs). 768px.
 *   app      — Dashboard / admin / authenticated app shell. 1600px.
 *              Matches the existing app/dashboard/layout.tsx anchor.
 *
 * Usage:
 *   <PageContainer variant="content">
 *     ... your sections ...
 *   </PageContainer>
 *
 * Or for sub-sections inside a page where you want a narrower text
 * column inside a wider page:
 *
 *   <PageContainer variant="content">
 *     <PageContainer variant="prose" className="mx-auto">
 *       ... narrow text ...
 *     </PageContainer>
 *   </PageContainer>
 *
 * Background bleeds (decorative blobs, hero glows) should be
 * absolutely-positioned siblings of PageContainer, NOT children —
 * they can extend full-bleed while content stays controlled.
 */

import type { ReactNode, ElementType } from "react";

export type PageContainerVariant =
  | "chrome"
  | "wide"
  | "content"
  | "prose"
  | "app";

/**
 * Tailwind class for each variant. Exported so non-component callers
 * (rare — e.g. a third-party that can't import JSX) can still align.
 */
export const PAGE_CONTAINER_MAX_W: Record<PageContainerVariant, string> = {
  chrome:  "max-w-7xl",            // 1280px — Navigation, Footer
  wide:    "max-w-7xl",            // 1280px — Marketing hero
  content: "max-w-6xl",            // 1152px — DEFAULT marketing body
  prose:   "max-w-3xl",            // 768px  — readable text
  app:     "max-w-[1600px]",       // dashboard / admin
};

/**
 * Horizontal padding scale per variant. Marketing pages get more
 * breathing room on tablet+ than the dashboard does (the dashboard
 * has a sidebar already eating left-side space).
 */
const PAGE_CONTAINER_PX: Record<PageContainerVariant, string> = {
  chrome:  "px-4 sm:px-6 lg:px-8",
  wide:    "px-6 md:px-10",
  content: "px-6 md:px-10",
  prose:   "px-6 md:px-10",
  app:     "px-4 sm:px-6 lg:px-8",
};

export interface PageContainerProps {
  variant: PageContainerVariant;
  /** Render as a different element. Defaults to `<div>`. */
  as?: ElementType;
  /** Optional extra classes — appended after the variant defaults. */
  className?: string;
  /** Optional id (for in-page anchors). */
  id?: string;
  children: ReactNode;
}

export function PageContainer({
  variant,
  as: Tag = "div",
  className = "",
  id,
  children,
}: PageContainerProps) {
  const cls = [
    PAGE_CONTAINER_MAX_W[variant],
    "mx-auto",
    PAGE_CONTAINER_PX[variant],
    className,
  ].filter(Boolean).join(" ");
  return (
    <Tag id={id} className={cls}>
      {children}
    </Tag>
  );
}
