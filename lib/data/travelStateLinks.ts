/**
 * Official travel, visa, and USCIS resources — from travel.state.gov and uscis.gov.
 * All links point to U.S. government sites.
 */

export interface ResourceLink {
  title: string;
  description: string;
  href: string;
  category: "visa" | "embassy" | "travel" | "forms" | "bulletin" | "uscis";
}

export const travelStateResources: ResourceLink[] = [
  {
    title: "Visa Bulletin",
    description: "Monthly visa availability and priority dates for family and employment categories",
    href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html",
    category: "bulletin",
  },
  {
    title: "CEAC Case Status",
    description: "Check your visa application status (NVC, consular processing)",
    href: "https://ceac.state.gov/CEACStatTracker/Status.aspx",
    category: "visa",
  },
  {
    title: "Find Embassies & Consulates",
    description: "Locations, contact info, and services by country",
    href: "https://www.usembassy.gov/",
    category: "embassy",
  },
  {
    title: "Visa Types & Requirements",
    description: "Immigrant and non-immigrant visa categories",
    href: "https://travel.state.gov/content/travel/en/us-visas.html",
    category: "visa",
  },
  {
    title: "DS-260 Form (Immigrant Visa)",
    description: "Online immigrant visa application",
    href: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process/step-1-submit-a-petition.html",
    category: "forms",
  },
  {
    title: "NVC Processing",
    description: "National Visa Center—what to expect after petition approval",
    href: "https://travel.state.gov/content/travel/en/us-visas/immigrate/national-visa-center.html",
    category: "visa",
  },
  {
    title: "Travel Advisories",
    description: "Country-specific travel safety information",
    href: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html",
    category: "travel",
  },
  {
    title: "Visa Wait Times",
    description: "Estimated interview wait times by embassy",
    href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/waittimes.html",
    category: "visa",
  },
  {
    title: "International Travel",
    description: "Passports, vaccinations, and country info",
    href: "https://travel.state.gov/content/travel/en/international-travel.html",
    category: "travel",
  },
  {
    title: "Document Requirements",
    description: "Civil documents for visa interviews",
    href: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process/collect-and-submit-forms-and-documents-to-the-nvc/step-5-collect-supporting-documents.html",
    category: "forms",
  },
  {
    title: "Visa Photo Requirements",
    description: "Passport-style photo specs for visa applications",
    href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html",
    category: "forms",
  },
  {
    title: "Immigrant Visa Process",
    description: "Step-by-step consular processing overview",
    href: "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html",
    category: "visa",
  },
  // Travel.State.Gov — additional
  {
    title: "U.S. Passports",
    description: "Get or renew a U.S. passport—forms, fees, and processing times",
    href: "https://travel.state.gov/content/travel/en/passports.html",
    category: "travel",
  },
  {
    title: "STEP — Smart Traveler Enrollment",
    description: "Enroll to receive alerts and help the U.S. locate you in an emergency abroad",
    href: "https://step.state.gov/",
    category: "travel",
  },
  {
    title: "MyTravelGov",
    description: "Manage travel documents and requests online",
    href: "https://travel.state.gov/content/travel/en/about-us/mytravelgov.html",
    category: "travel",
  },
  {
    title: "International Parental Child Abduction",
    description: "Resources if your child was abducted to or from the U.S.",
    href: "https://travel.state.gov/content/travel/en/International-Parental-Child-Abduction.html",
    category: "travel",
  },
  {
    title: "Document Authentication (Apostille)",
    description: "Certify documents for use overseas",
    href: "https://travel.state.gov/content/travel/en/records-and-authentications/authenticate-your-document.html",
    category: "forms",
  },
  {
    title: "Travel.State.Gov Newsroom",
    description: "Official news, updates, and announcements from the Department of State",
    href: "https://travel.state.gov/content/travel/en/newsroom.html",
    category: "travel",
  },
  {
    title: "Intercountry Adoption",
    description: "Adopting a child to or from the U.S.—process and requirements",
    href: "https://travel.state.gov/content/travel/en/Intercountry-Adoption.html",
    category: "travel",
  },
  {
    title: "Replace or Certify Life Event Documents",
    description: "Replace birth certificates, marriage certificates, and other documents for use overseas",
    href: "https://travel.state.gov/content/travel/en/records-and-authentications.html",
    category: "forms",
  },
  {
    title: "Legal Resources (Travel.State.Gov)",
    description: "Legal information for travelers and U.S. law enforcement",
    href: "https://travel.state.gov/content/travel/en/about-us/legal-information.html",
    category: "travel",
  },
  {
    title: "Travel.State.Gov Contact",
    description: "Contact the Bureau of Consular Affairs",
    href: "https://travel.state.gov/content/travel/en/about-us/contact-us.html",
    category: "travel",
  },
  {
    title: "Travel.State.Gov About Us",
    description: "About the Bureau of Consular Affairs",
    href: "https://travel.state.gov/content/travel/en/about-us.html",
    category: "travel",
  },
  {
    title: "Congressional Liaison",
    description: "Congressional inquiries for constituent visa and passport cases",
    href: "https://travel.state.gov/content/travel/en/about-us/congressional-liaison.html",
    category: "travel",
  },
  {
    title: "Special Issuance Agency",
    description: "Special passport issuance for urgent travel, lost/stolen passports",
    href: "https://travel.state.gov/content/travel/en/passports/passport-help/special-issuance-agency.html",
    category: "travel",
  },
  {
    title: "Requesting a Record (Replace Documents)",
    description: "Replace birth, marriage, death certificates issued by the Department of State",
    href: "https://travel.state.gov/content/travel/en/replace-certify-docs/requesting-a-record.html",
    category: "forms",
  },
  {
    title: "Nonimmigrant Visa (Visitor, Student, Work)",
    description: "B-1/B-2, F-1, H-1B, and other nonimmigrant visa types",
    href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/all-visa-categories.html",
    category: "visa",
  },
  {
    title: "Student Visa (F-1, M-1)",
    description: "Study at U.S. schools—academic (F-1) and vocational (M-1). OPT, STEM extension.",
    href: "https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html",
    category: "visa",
  },
  {
    title: "Employment-Based Visas",
    description: "H-1B, L-1, O-1, and employment-based green cards (EB-1, EB-2, EB-3)",
    href: "https://travel.state.gov/content/travel/en/us-visas/employment.html",
    category: "visa",
  },
  {
    title: "Business & Treaty Investor (B-1, E-2, L-1)",
    description: "Business visits, treaty investors, intracompany transfers",
    href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/all-visa-categories.html",
    category: "visa",
  },
  {
    title: "Visa Reciprocity & Country Info",
    description: "Visa requirements and fees by nationality",
    href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/reciprocity-by-country.html",
    category: "visa",
  },
  // USCIS — official
  {
    title: "USCIS Case Status",
    description: "Check your case status with your receipt number",
    href: "https://egov.uscis.gov/casestatus/landing.do",
    category: "uscis",
  },
  {
    title: "USCIS Forms",
    description: "Download official immigration forms (I-130, I-485, N-400, etc.)",
    href: "https://www.uscis.gov/forms",
    category: "uscis",
  },
  {
    title: "USCIS Filing Fees",
    description: "Current fee schedule for all forms",
    href: "https://www.uscis.gov/fees",
    category: "uscis",
  },
  {
    title: "USCIS Processing Times",
    description: "Official processing time estimates by form and service center",
    href: "https://egov.uscis.gov/processing-times/",
    category: "uscis",
  },
  {
    title: "USCIS Contact Center",
    description: "Phone, online tools, and appointment scheduling",
    href: "https://www.uscis.gov/contact",
    category: "uscis",
  },
  {
    title: "Find a USCIS Office",
    description: "Locations, hours, and services",
    href: "https://www.uscis.gov/about-us/find-a-uscis-office",
    category: "uscis",
  },
  {
    title: "Policy Manual",
    description: "USCIS policy and legal guidance",
    href: "https://www.uscis.gov/policy-manual",
    category: "uscis",
  },
];
