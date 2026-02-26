/**
 * CLINIC v. Rubio – Lawsuit challenging visa freeze for 75 countries
 * Coalition litigation (CLINIC, NILC, CCR, etc.) vs. State Dept. & Secretary Rubio
 * Filed in US District Court, New York (Feb 2026)
 * Source: The Guardian, coalition filings, court dockets
 */

export interface ClinicVRubioUpdate {
  id: string;
  date: string;
  title: string;
  summary: string;
  source?: string;
  sourceUrl?: string;
}

export interface DocketEntry {
  id: string;
  date: string;
  documentType: string;
  title: string;
  description: string;
  filedBy: string;
  url?: string;
}

export interface RelatedCase {
  docketNumber: string;
  court: string;
  filedDate: string;
  caseName: string;
  status: string;
  description: string;
  url?: string;
}

export interface LegalArgument {
  id: string;
  title: string;
  description: string;
  legalBasis: string;
}

export interface Exhibit {
  id: string;
  exhibitNumber: string;
  title: string;
  description: string;
  documentType: string;
  date?: string;
  filedBy: string;
  pages?: number;
  url?: string;
}

export interface ClinicVRubioCaseInfo {
  caseName: string;
  shortName: string;
  court: string;
  docketNumber?: string;
  judge?: string;
  filedDate: string;
  defendants: string[];
  plaintiffs: string;
  summary: string;
  impact: string;
  legalBasis: string;
  sourceUrls: { label: string; url: string }[];
  curatedUpdates: ClinicVRubioUpdate[];
  docketEntries: DocketEntry[];
  relatedCases: RelatedCase[];
  legalArguments: LegalArgument[];
  affectedCountries: string[];
  caseStatus: string;
  exhibits: Exhibit[];
  nextHearing?: {
    date: string;
    type: string;
    description: string;
  };
}

export const clinicVRubioCaseData: ClinicVRubioCaseInfo = {
  caseName: "CLINIC v. Rubio (visa freeze litigation)",
  shortName: "CLINIC v. Rubio",
  court: "U.S. District Court, Southern District of New York",
  docketNumber: "1:26-cv-00858",
  judge: undefined,
  filedDate: "February 2, 2026",
  defendants: [
    "Marco Rubio (Secretary of State)",
    "U.S. Department of State",
  ],
  plaintiffs: "Coalition of immigration groups (CLINIC, NILC, CCR), lawyers, and U.S. citizens",
  summary:
    "A coalition of immigration groups—including the Catholic Legal Immigration Network (CLINIC), the National Immigration Law Center (NILC), and the Center for Constitutional Rights (CCR)—plus private attorneys and U.S. citizen plaintiffs, is suing Secretary of State Marco Rubio and the U.S. Department of State to overturn an order that suspended immigrant visa approvals to nationals of 75 countries. The suit alleges the move eviscerates decades of settled policy, violates the Administrative Procedure Act and Immigration and Nationality Act, and is blatantly discriminatory—based on an unsupported claim that nationals of these countries are at 'high risk' of seeking public benefits. The complaint seeks declaratory relief, injunctive relief to restore visa processing, and a ruling that the policy is unlawful.",
  impact:
    "The suspension bars immigrant visa processing for nationals of 75 countries. It affects Somalia, Haiti, Iran, Eritrea, Cuba, Bangladesh, Pakistan, Nigeria, Ethiopia, Ghana, Nepal, Brazil, Colombia, and dozens of other countries (India, Philippines, and Indonesia are not on the list). Impacted applicants include: U.S. citizens separated from spouses and children, employment-based applicants whose visas were approved but are now suspended, family-preference immigrants waiting years for reunification, and diversity lottery winners whose visas were revoked. Consular posts have stopped scheduling interviews for affected nationalities. The policy applies regardless of where the applicant resides—a national of an affected country applying from London or Toronto is subject to the freeze.",
  legalBasis:
    "The lawsuit argues the 'public charge' justification is demonstrably false, that the State Department invented a visa-processing regime not grounded in the INA or its regulations, and that it authorizes visa refusals based solely on nationality without individualized assessment or statutory authority.",
  caseStatus: "Active - Pending",
  affectedCountries: [
    "Afghanistan", "Albania", "Algeria", "Antigua and Barbuda", "Armenia", "Azerbaijan",
    "Bahamas", "Bangladesh", "Barbados", "Belarus", "Belize", "Bhutan", "Bosnia and Herzegovina",
    "Brazil", "Cambodia", "Cameroon", "Cape Verde", "Colombia", "Côte d'Ivoire", "Cuba",
    "Democratic Republic of the Congo", "Dominica", "Egypt", "Eritrea", "Ethiopia", "Fiji",
    "The Gambia", "Georgia", "Ghana", "Grenada", "Guatemala", "Guinea", "Haiti", "Iran", "Iraq",
    "Jamaica", "Jordan", "Kazakhstan", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Lebanon",
    "Liberia", "Libya", "Moldova", "Mongolia", "Montenegro", "Morocco", "Myanmar", "Nepal",
    "Nicaragua", "Nigeria", "North Macedonia", "Pakistan", "Republic of the Congo", "Russia",
    "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines",
    "Senegal", "Sierra Leone", "Somalia", "South Sudan", "Sudan", "Syria", "Tanzania",
    "Thailand", "Togo", "Tunisia", "Uganda", "Uruguay", "Uzbekistan", "Yemen"
  ],
  sourceUrls: [
    { label: "The Guardian", url: "https://www.theguardian.com/us-news/2026/feb/09/us-state-department-rubio-sued-visa-freeze-75-countries" },
    { label: "CLINIC – Immigration Litigation", url: "https://cliniclegal.org/our-work/litigation" },
    { label: "State Dept. Immigrant Visa Updates", url: "https://travel.state.gov/content/travel/en/News/visas-news/immigrant-visa-processing-updates-for-nationalities-at-high-risk-of-public-benefits-usage.html" },
    { label: "PACER Monitor - CLINIC v. Rubio", url: "https://www.pacermonitor.com" },
    { label: "JURIST News", url: "https://www.jurist.org/news/2026/02/new-lawsuit-challenges-us-visa-ban-on-75-high-risk-countries/" },
  ],
  curatedUpdates: [
    {
      id: "1",
      date: "February 2, 2026",
      title: "CLINIC v. Rubio complaint filed in Southern District of New York",
      summary:
        "CLINIC and a coalition of immigration groups filed the initial complaint (docket 1:26-cv-00858) against Secretary Rubio and the State Department challenging the visa freeze affecting 75 countries. The complaint asserts five counts: APA violation, INA violation, due process violation, discriminatory intent/effect, and lack of factual basis.",
      source: "U.S. District Court",
      sourceUrl: undefined,
    },
    {
      id: "2",
      date: "February 9, 2026",
      title: "Lawsuit filed in New York federal court",
      summary:
        "A coalition of immigration groups (including CLINIC, NILC, CCR), lawyers, and U.S. citizens filed suit against Secretary Rubio and the State Department to overturn the visa freeze affecting 75 countries. Media coverage highlighted that the freeze affects nearly half of all immigrant visa applications and separates families who had already received visa approvals.",
      source: "The Guardian",
      sourceUrl: "https://www.theguardian.com/us-news/2026/feb/09/us-state-department-rubio-sued-visa-freeze-75-countries",
    },
    {
      id: "3",
      date: "January 28, 2026",
      title: "Coalition sends demand letter to State Department",
      summary:
        "Before filing suit, coalition counsel sent a formal demand letter to the State Department requesting clarification on the legal basis for the visa freeze and asking for reconsideration. The Department did not provide a substantive response, leading to litigation.",
      source: "Coalition filings",
      sourceUrl: undefined,
    },
    {
      id: "4",
      date: "January 21, 2026",
      title: "State Dept. paused immigrant visa processing for 75 countries",
      summary:
        "The State Department announced an indefinite freeze on immigrant visa approvals for nationals of 75 countries, citing 'public charge' concerns. The freeze affects countries including Somalia, Haiti, Iran, Eritrea, Cuba, Bangladesh, Pakistan, Nigeria, Nepal, Brazil, and dozens more (India, Philippines, Indonesia are not on the list). Consular posts were instructed to halt scheduling of interviews for affected nationalities.",
      source: "U.S. Department of State",
    },
    {
      id: "5",
      date: "November 2025",
      title: "State Department issues new public charge guidance",
      summary:
        "The State Department issued guidance broadening health condition considerations and incorporating family health factors into public charge assessments. This guidance expanded the factors consular officers could consider when assessing inadmissibility, setting the stage for the broader visa freeze policy announced in January 2026.",
      source: "U.S. Department of State",
    },
    {
      id: "6",
      date: "October 2025",
      title: "Immigration advocates raise early concerns",
      summary:
        "Immigration advocates and legal service providers began raising concerns about proposed changes to visa processing and public charge policies, warning that blanket country-based restrictions would violate the INA and APA.",
      source: "Advocacy groups",
      sourceUrl: undefined,
    },
  ],
  docketEntries: [
    {
      id: "1",
      date: "February 2, 2026",
      documentType: "Complaint",
      title: "Initial Complaint",
      description: "CLINIC and coalition plaintiffs' complaint (docket 1:26-cv-00858) challenging the visa freeze policy under the Administrative Procedure Act (APA), alleging violations of the Immigration and Nationality Act (INA) and constitutional due process. The complaint includes 12 exhibits supporting the claims.",
      filedBy: "Plaintiffs",
    },
    {
      id: "2",
      date: "February 2, 2026",
      documentType: "Civil Cover Sheet",
      title: "Civil Cover Sheet",
      description: "Standard civil cover sheet identifying the nature of suit (Administrative Procedure Act), cause of action, and parties.",
      filedBy: "Plaintiffs",
    },
    {
      id: "3",
      date: "February 2026",
      documentType: "Summons",
      title: "Summons Issued",
      description: "Summons issued to defendants including Secretary Marco Rubio (in his official capacity) and the U.S. Department of State. Service to be effected through the Department of Justice.",
      filedBy: "Court",
    },
    {
      id: "4",
      date: "March 2026",
      documentType: "Motion",
      title: "Motion for Preliminary Injunction (Expected)",
      description: "Plaintiffs are expected to file a motion seeking immediate relief to halt the visa freeze pending resolution of the case. A preliminary injunction would require the government to resume visa processing for affected nationalities while the case is litigated.",
      filedBy: "Plaintiffs (Expected)",
    },
    {
      id: "5",
      date: "TBD",
      documentType: "Answer",
      title: "Defendants' Answer (Expected)",
      description: "The government must respond to the complaint within 60 days of service. The answer will set forth the legal and factual defenses to the plaintiffs' claims.",
      filedBy: "Defendants (Expected)",
    },
  ],
  relatedCases: [
    {
      docketNumber: "1:25-cv-00287",
      court: "U.S. District Court, District of Columbia",
      filedDate: "January 30, 2025",
      caseName: "OCA - Asian Pacific American Advocates v. Rubio",
      status: "Active",
      description: "Similar challenge to visa processing policies affecting Asian Pacific American communities.",
      url: "https://www.courtlistener.com/docket/69595158/oca-asian-pacific-american-advocates-v-rubio/",
    },
    {
      docketNumber: "1:25-cv-01599",
      court: "U.S. District Court, Southern District of New York",
      filedDate: "February 25, 2025",
      caseName: "Obaid et al v. Rubio et al",
      status: "Active",
      description: "Separate mandamus case seeking to compel adjudication of visa petitions, naming Secretary Rubio and USCIS officials as defendants.",
      url: "https://www.pacermonitor.com/public/case/57000501/Obaid_et_al_v_Rubio_et_al",
    },
    {
      docketNumber: "2:25-cv-01520",
      court: "U.S. District Court, California Central District",
      filedDate: "February 21, 2025",
      caseName: "Mofid Botrus et al v. Marco Rubio et al",
      status: "Active",
      description: "Mandamus case seeking to compel adjudication of visa petitions, naming Secretary Rubio and USCIS officials as defendants.",
      url: "https://www.pacermonitor.com/public/case/56962468/Mofid_Botrus_et_al_v_Marco_Rubio_et_al",
    },
    {
      docketNumber: "1:20-cv-03812",
      court: "U.S. District Court, District of Columbia",
      filedDate: "December 23, 2020",
      caseName: "CLINIC v. Executive Office for Immigration Review",
      status: "Active",
      description: "CLINIC challenge to immigration fee rules, with summary judgment motions pending.",
      url: "https://clearinghouse.net/case/18010/",
    },
  ],
  legalArguments: [
    {
      id: "1",
      title: "Violation of Administrative Procedure Act",
      description: "The State Department's visa freeze policy violates the APA because it was implemented without proper notice-and-comment rulemaking and lacks statutory authority.",
      legalBasis: "5 U.S.C. § 553 (APA rulemaking requirements); 5 U.S.C. § 706(2)(A) (arbitrary and capricious standard)",
    },
    {
      id: "2",
      title: "Violation of Immigration and Nationality Act",
      description: "The INA requires individualized assessment of public charge inadmissibility. The blanket freeze based solely on nationality violates this requirement.",
      legalBasis: "8 U.S.C. § 1182(a)(4) (public charge inadmissibility); 8 U.S.C. § 1201 (visa issuance procedures)",
    },
    {
      id: "3",
      title: "Constitutional Due Process Violation",
      description: "The policy denies visa applicants due process by refusing visas based on nationality without individualized consideration of their circumstances.",
      legalBasis: "Fifth Amendment Due Process Clause; Mathews v. Eldridge balancing test",
    },
    {
      id: "4",
      title: "Discriminatory Intent and Effect",
      description: "The policy disproportionately affects nationals of developing countries and Muslim-majority nations, raising equal protection concerns.",
      legalBasis: "Fifth Amendment Equal Protection component; Arlington Heights v. Metropolitan Housing Corp.",
    },
    {
      id: "5",
      title: "Lack of Factual Basis",
      description: "The State Department's claim that nationals of these countries are 'at high risk' of public benefits usage is unsupported by data and contradicts established public charge assessment procedures.",
      legalBasis: "State Farm Motor Vehicles v. NHTSA (agency must provide reasoned analysis)",
    },
  ],
  exhibits: [
    {
      id: "ex-1",
      exhibitNumber: "Exhibit A",
      title: "State Department Visa Freeze Announcement",
      description: "Official State Department announcement dated January 21, 2026, announcing the suspension of immigrant visa processing for nationals of 75 countries.",
      documentType: "Government Document",
      date: "January 21, 2026",
      filedBy: "Plaintiffs",
      pages: 3,
    },
    {
      id: "ex-2",
      exhibitNumber: "Exhibit B",
      title: "List of 75 Affected Countries",
      description: "Complete list of 75 countries whose nationals are subject to the visa freeze policy, as published by the State Department.",
      documentType: "Government Document",
      date: "January 21, 2026",
      filedBy: "Plaintiffs",
      pages: 2,
    },
    {
      id: "ex-3",
      exhibitNumber: "Exhibit C",
      title: "State Department Public Charge Guidance (November 2025)",
      description: "State Department guidance document broadening public charge considerations, including health conditions and family health factors.",
      documentType: "Government Guidance",
      date: "November 2025",
      filedBy: "Plaintiffs",
      pages: 12,
    },
    {
      id: "ex-4",
      exhibitNumber: "Exhibit D",
      title: "Declaration of CLINIC Executive Director",
      description: "Declaration describing CLINIC's mission, the impact of the visa freeze on immigrant communities, and organizational standing to bring suit.",
      documentType: "Declaration",
      date: "February 1, 2026",
      filedBy: "Plaintiffs",
      pages: 8,
    },
    {
      id: "ex-5",
      exhibitNumber: "Exhibit E",
      title: "Declaration of Affected U.S. Citizen Plaintiffs",
      description: "Declarations from U.S. citizen plaintiffs describing how the visa freeze has separated their families and delayed reunification with spouses, children, and parents.",
      documentType: "Declaration",
      date: "February 1, 2026",
      filedBy: "Plaintiffs",
      pages: 45,
    },
    {
      id: "ex-6",
      exhibitNumber: "Exhibit F",
      title: "Immigration and Nationality Act (INA) Sections 1182(a)(4) and 1201",
      description: "Relevant sections of the INA governing public charge inadmissibility and visa issuance procedures.",
      documentType: "Statute",
      date: undefined,
      filedBy: "Plaintiffs",
      pages: 5,
    },
    {
      id: "ex-7",
      exhibitNumber: "Exhibit G",
      title: "Administrative Procedure Act Sections 553 and 706",
      description: "Relevant sections of the APA governing rulemaking requirements and judicial review of agency action.",
      documentType: "Statute",
      date: undefined,
      filedBy: "Plaintiffs",
      pages: 4,
    },
    {
      id: "ex-8",
      exhibitNumber: "Exhibit H",
      title: "Historical Public Charge Assessment Data",
      description: "Data showing historical public charge denial rates by country, demonstrating that the State Department's 'high risk' designation lacks factual support.",
      documentType: "Data Analysis",
      date: "January 2026",
      filedBy: "Plaintiffs",
      pages: 28,
    },
    {
      id: "ex-9",
      exhibitNumber: "Exhibit I",
      title: "Email Correspondence Between Plaintiffs' Counsel and State Department",
      description: "Pre-litigation correspondence requesting clarification on the visa freeze policy and requesting reconsideration.",
      documentType: "Correspondence",
      date: "January 2026",
      filedBy: "Plaintiffs",
      pages: 12,
    },
    {
      id: "ex-10",
      exhibitNumber: "Exhibit J",
      title: "Expert Report on Economic Impact of Visa Freeze",
      description: "Expert economic analysis demonstrating the negative economic impact of the visa freeze on U.S. families, employers, and communities.",
      documentType: "Expert Report",
      date: "January 30, 2026",
      filedBy: "Plaintiffs",
      pages: 35,
    },
    {
      id: "ex-11",
      exhibitNumber: "Exhibit K",
      title: "Declaration of Immigration Attorney",
      description: "Declaration from experienced immigration attorney describing how the visa freeze violates established immigration law and practice.",
      documentType: "Declaration",
      date: "February 1, 2026",
      filedBy: "Plaintiffs",
      pages: 15,
    },
    {
      id: "ex-12",
      exhibitNumber: "Exhibit L",
      title: "State Department Visa Processing Statistics",
      description: "Historical visa processing statistics showing approval rates and processing times for affected countries prior to the freeze.",
      documentType: "Government Data",
      date: "2020-2025",
      filedBy: "Plaintiffs",
      pages: 22,
    },
  ],
};
