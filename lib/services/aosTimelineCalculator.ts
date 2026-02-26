/**
 * AOS Timeline Calculator
 * Matches iOS AOSTimelineCalculator.swift
 * Handles I-485, I-765, N-400, I-751 processing time calculations
 */

/**
 * Convert months to days deterministically
 * Uses 30.4 days per month (average days per month in a year)
 */
function monthsToDays(months: number): number {
  return Math.round(months * 30.4);
}

/**
 * Get processing months for I-485 based on filing category
 * Returns months as number for precise calculations
 */
export function getI485ProcessingMonths(category?: string | null): number {
  if (!category || category.trim() === "") {
    // Default to "Other" if category is missing/unknown
    return 20.2;
  }

  // Map category to processing months based on USCIS report
  const normalizedCategory = category.toLowerCase().trim();
  switch (normalizedCategory) {
    case "asylum":
      return 14.4;
    case "cuban":
      return 11.4;
    case "employment":
      return 14.1;
    case "family":
      return 8.8;
    case "refugee":
      return 9.2;
    case "other":
      return 20.2;
    default:
      // Unknown category - default to "Other"
      return 20.2;
  }
}

/**
 * Get processing days for I-485 based on filing category
 */
export function getI485ProcessingDays(category?: string | null): number {
  const months = getI485ProcessingMonths(category);
  return monthsToDays(months);
}

/**
 * Get processing months for I-751
 */
export function getI751ProcessingMonths(): number {
  return 20.6;
}

/**
 * Get processing days for I-751
 */
export function getI751ProcessingDays(): number {
  return monthsToDays(getI751ProcessingMonths());
}

/**
 * Get processing months for N-400
 */
export function getN400ProcessingMonths(): number {
  return 6.7;
}

/**
 * Get processing days for N-400
 */
export function getN400ProcessingDays(): number {
  return monthsToDays(getN400ProcessingMonths());
}

/**
 * Get processing months for I-765
 */
export function getI765ProcessingMonths(): number {
  return 3.7;
}

/**
 * Get processing days for I-765
 */
export function getI765ProcessingDays(): number {
  return monthsToDays(getI765ProcessingMonths());
}

/**
 * Get processing months range for N-400 (for UI display)
 * Returns (earliest, median, latest) in months
 */
export function getN400ProcessingMonthsRange(): { earliest: number; median: number; latest: number } {
  return { earliest: 6.4, median: 6.7, latest: 6.8 };
}

/**
 * Get processing days range for N-400 (for UI display)
 * Returns (earliest, median, latest) in days
 */
export function getN400ProcessingDaysRange(): { earliest: number; median: number; latest: number } {
  const range = getN400ProcessingMonthsRange();
  return {
    earliest: monthsToDays(range.earliest),
    median: monthsToDays(range.median),
    latest: monthsToDays(range.latest),
  };
}

/**
 * Get I-485 category display options with processing times
 */
export function getI485CategoryOptions(): Array<{ value: string; display: string }> {
  return [
    { value: "Asylum", display: "Asylum (14.4 months)" },
    { value: "Cuban", display: "Cuban (11.4 months)" },
    { value: "Employment", display: "Employment (14.1 months)" },
    { value: "Family", display: "Family (8.8 months)" },
    { value: "Other", display: "Other (20.2 months)" },
    { value: "Refugee", display: "Refugee (9.2 months)" },
  ];
}
