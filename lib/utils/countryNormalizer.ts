/**
 * Country name normalization and country code mapping
 * Matches iOS CountryNormalizer.swift
 */

const COUNTRY_CODE_MAP: Record<string, string> = {
  "united states": "US",
  "usa": "US",
  "us": "US",
  "united states of america": "US",
  "india": "IN",
  "pakistan": "PK",
  "philippines": "PH",
  "china": "CN",
  "mexico": "MX",
  "vietnam": "VN",
  "bangladesh": "BD",
  "canada": "CA",
  "united kingdom": "GB",
  "uk": "GB",
  "great britain": "GB",
  "britain": "GB",
  "nigeria": "NG",
  "nepal": "NP",
  "sri lanka": "LK",
  "brazil": "BR",
  "colombia": "CO",
  "jamaica": "JM",
  "haiti": "HT",
  "dominican republic": "DO",
  "south korea": "KR",
  "korea": "KR",
  "japan": "JP",
  "australia": "AU",
  "south africa": "ZA",
  "ethiopia": "ET",
  "thailand": "TH",
};

/**
 * Normalize country name to standard format
 */
export function normalizeCountryName(country: string): string {
  const trimmed = country.trim();
  const lowercased = trimmed.toLowerCase();

  // Handle common country name variations
  switch (lowercased) {
    case "usa":
    case "us":
    case "united states of america":
      return "United States";
    case "uk":
    case "great britain":
    case "britain":
      return "United Kingdom";
    case "uae":
    case "united arab emirates":
      return "United Arab Emirates";
    default:
      // Capitalize first letter of each word
      return trimmed
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
  }
}

/**
 * Get ISO country code from country name
 * Matches iOS CountryNormalizer.countryCode(for:)
 */
export function getCountryCode(country: string): string | undefined {
  const normalized = normalizeCountryName(country).toLowerCase();
  return COUNTRY_CODE_MAP[normalized];
}
