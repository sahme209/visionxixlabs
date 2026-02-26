"use client";

import { FormGuide } from "@/lib/types";

export type FormCategory = 
  | "Family-Based"
  | "Employment-Based"
  | "Citizenship and Naturalization"
  | "Green Card-Based"
  | "Humanitarian Benefits"
  | "Adoptions";

interface USCISFormCategoryBadgeProps {
  category: FormCategory;
  className?: string;
}

/**
 * USCIS-style form category badge
 * Matches official USCIS.gov form categorization
 */
export default function USCISFormCategoryBadge({
  category,
  className = "",
}: USCISFormCategoryBadgeProps) {
  const categoryColors: Record<FormCategory, string> = {
    "Family-Based": "bg-blue-100 dark:bg-blue-900/30 text-gray-800 dark:text-gray-200 border-blue-300 dark:border-blue-700",
    "Employment-Based": "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700",
    "Citizenship and Naturalization": "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700",
    "Green Card-Based": "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700",
    "Humanitarian Benefits": "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700",
    "Adoptions": "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider border ${categoryColors[category]} ${className}`}
    >
      {category}
    </span>
  );
}

/**
 * Get form category from guide ID
 */
export function getFormCategory(guideId: string): FormCategory {
  const categoryMap: Record<string, FormCategory> = {
    i130: "Family-Based",
    i129f: "Family-Based",
    i485: "Green Card-Based",
    i765: "Employment-Based",
    n400: "Citizenship and Naturalization",
    i140: "Employment-Based",
    i131: "Green Card-Based",
    i751: "Green Card-Based",
    i600: "Adoptions",
    i600a: "Adoptions",
    i800: "Adoptions",
    i800a: "Adoptions",
    i589: "Humanitarian Benefits",
    i821: "Humanitarian Benefits",
    i730: "Humanitarian Benefits",
  };

  return categoryMap[guideId.toLowerCase()] || "Family-Based";
}
