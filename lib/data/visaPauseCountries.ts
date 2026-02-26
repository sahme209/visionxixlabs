/**
 * Official List of Countries Affected by Visa Pause
 * Source: U.S. Department of State / CNBC Jan 15, 2026
 * Reference: https://www.cnbc.com/2026/01/15/us-stops-immigrant-visas-for-75-countries-see-the-full-list.html
 *
 * Note: India is NOT on the list. Philippines, Indonesia, Vietnam, Sri Lanka, Kenya, etc. are also not affected.
 */

export const VISA_PAUSE_AFFECTED_COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Antigua and Barbuda",
  "Armenia",
  "Azerbaijan",
  "Bahamas",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belize",
  "Bhutan",
  "Bosnia and Herzegovina",
  "Brazil",
  "Cambodia",
  "Cameroon",
  "Cape Verde",
  "Colombia",
  "Côte d'Ivoire",
  "Cuba",
  "Democratic Republic of the Congo",
  "Dominica",
  "Egypt",
  "Eritrea",
  "Ethiopia",
  "Fiji",
  "The Gambia",
  "Georgia",
  "Ghana",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Haiti",
  "Iran",
  "Iraq",
  "Jamaica",
  "Jordan",
  "Kazakhstan",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Lebanon",
  "Liberia",
  "Libya",
  "Moldova",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Myanmar",
  "Nepal",
  "Nicaragua",
  "Nigeria",
  "North Macedonia",
  "Pakistan",
  "Republic of the Congo",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Senegal",
  "Sierra Leone",
  "Somalia",
  "South Sudan",
  "Sudan",
  "Syria",
  "Tanzania",
  "Thailand",
  "Togo",
  "Tunisia",
  "Uganda",
  "Uruguay",
  "Uzbekistan",
  "Yemen",
] as const;

/** Map country codes/aliases to full names for matching */
export const COUNTRY_CODE_TO_FULL: Record<string, string> = {
  PK: "Pakistan", PAK: "Pakistan",
  BD: "Bangladesh", BGD: "Bangladesh",
  NG: "Nigeria", NGA: "Nigeria",
  NP: "Nepal", NPL: "Nepal",
  BR: "Brazil", BRA: "Brazil",
  EG: "Egypt", EGY: "Egypt",
  GH: "Ghana", GHA: "Ghana",
  CO: "Colombia", COL: "Colombia",
  ET: "Ethiopia", ETH: "Ethiopia",
  HT: "Haiti", HTI: "Haiti",
  TZ: "Tanzania", TZA: "Tanzania",
};

/** Normalize country to full name for pause/embassy lookups */
export function normalizeCountryForPause(country: string | null | undefined): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (!trimmed) return null;
  const code = trimmed.toUpperCase();
  if (COUNTRY_CODE_TO_FULL[code]) return COUNTRY_CODE_TO_FULL[code];
  if (trimmed.toLowerCase() === "burma") return "Myanmar";
  if (trimmed.toLowerCase() === "kyrgyz republic") return "Kyrgyzstan";
  if (trimmed.toLowerCase() === "ivory coast" || trimmed.toLowerCase() === "cote d'ivoire") return "Côte d'Ivoire";
  return trimmed;
}

/**
 * Check if a country is affected by the visa pause
 */
export function isCountryAffectedByPause(country: string | null | undefined): boolean {
  if (!country) return false;
  const normalized = normalizeCountryForPause(country) ?? country.trim();
  if (!normalized) return false;
  if (VISA_PAUSE_AFFECTED_COUNTRIES.includes(normalized as any)) return true;
  const lower = normalized.toLowerCase();
  return VISA_PAUSE_AFFECTED_COUNTRIES.some(
    affected => affected.toLowerCase() === lower
  );
}

/**
 * Get high-priority affected countries (based on user base and processing delays)
 */
export const HIGH_PRIORITY_AFFECTED_COUNTRIES = [
  "Pakistan",
  "Bangladesh",
  "Nigeria",
  "Nepal",
] as const;

/**
 * Check if country is high-priority affected
 */
export function isHighPriorityAffectedCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return HIGH_PRIORITY_AFFECTED_COUNTRIES.some(
    priority => priority.toLowerCase() === country.toLowerCase()
  );
}

/**
 * Total number of affected countries
 */
export const TOTAL_AFFECTED_COUNTRIES = VISA_PAUSE_AFFECTED_COUNTRIES.length;
