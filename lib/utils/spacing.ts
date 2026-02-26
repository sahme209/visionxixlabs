/**
 * Standardized Spacing System
 * 
 * Use these constants for consistent spacing across the application.
 * Based on 4px grid system for clean alignment.
 */

export const Spacing = {
  /** 4px - Tight spacing between related elements */
  XS: '0.25rem',
  /** 8px - Small spacing within cards */
  SM: '0.5rem',
  /** 12px - Medium spacing (standard card padding) */
  MD: '0.75rem',
  /** 16px - Large spacing (standard card padding) */
  LG: '1rem',
  /** 20px - Extra large spacing (between sections) */
  XL: '1.25rem',
  /** 24px - Section spacing */
  XXL: '1.5rem',
  /** 32px - Major section spacing */
  XXXL: '2rem',
} as const;

/**
 * Typography Scale
 * 
 * Standardized font sizes and weights for consistent typography hierarchy.
 */
export const Typography = {
  sizes: {
    /** 11px - Very small text (captions, labels) */
    caption: '0.6875rem',
    /** 12px - Small secondary text (footnotes) */
    footnote: '0.75rem',
    /** 13px - Small body text */
    bodySm: '0.8125rem',
    /** 16px - Base body text */
    body: '1rem',
    /** 18px - Subheading */
    subhead: '1.125rem',
    /** 24px - Headline */
    headline: '1.5rem',
    /** 32px - Title */
    title: '2rem',
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.5,
    loose: 1.6,
  },
} as const;
