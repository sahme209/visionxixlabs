/**
 * Curated Unsplash images for VisaNova — immigration, USCIS, travel, documents.
 * All URLs use images.unsplash.com with ?w=1920&q=80 for hero backgrounds.
 */

const W = "?w=1920&q=80";
const W800 = "?w=800&q=80";

export const HERO_IMAGES = {
  /** Passport, boarding pass — travel, visa journey */
  passport:
    `https://images.unsplash.com/photo-1488646953014-85cb44e25828${W}`,
  /** Documents on desk — forms, paperwork, USCIS filing */
  documents:
    `https://images.unsplash.com/photo-1554224155-6726b3ff858f${W}`,
  /** Professional office — official, institutional */
  office:
    `https://images.unsplash.com/photo-1454165804606-c3d57bc86b40${W}`,
  /** Embassy/courthouse — consular, visa interviews */
  embassy:
    `https://images.unsplash.com/photo-1589829545856-d10d557cf95f${W}`,
  /** Airplane at gate — travel, international flight */
  airplane:
    `https://images.unsplash.com/photo-1488646953014-85cb44e25828${W}`,
  /** Passport with stamps — visa stamps, travel */
  passportStamps:
    `https://images.unsplash.com/photo-1548013146-7247f65966a4${W}`,
  /** Family at airport — reunion, immigration journey */
  familyTravel:
    `https://images.unsplash.com/photo-1511895426328-dc8714191300${W}`,
  /** Statue of Liberty — US immigration, citizenship */
  statueOfLiberty:
    `https://images.unsplash.com/photo-1485871981521-5b1fd3805eee${W}`,
  /** US flag — patriotism, citizenship, naturalization */
  usFlag:
    `https://images.unsplash.com/photo-1524661135-423995f22d0b${W}`,
  /** Hands with documents — filing, paperwork */
  handsDocuments:
    `https://images.unsplash.com/photo-1586281380349-632531db7ed4${W}`,
  /** Clipboard/checklist — evidence, documents to gather */
  checklist:
    `https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d${W}`,
  /** Calendar/planner — timeline, milestones, alerts */
  calendar:
    `https://images.unsplash.com/photo-1506784365847-bbad939e9335${W}`,
} as const;

/** For news headlines — smaller size, USA/immigration themed variety */
export const NEWS_IMAGES = {
  law: `https://images.unsplash.com/photo-1589829545856-d10d557cf95f${W800}`,
  visa: `https://images.unsplash.com/photo-1554224155-6726b3ff858f${W800}`,
  official: `https://images.unsplash.com/photo-1454165804606-c3d57bc86b40${W800}`,
  professional: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d${W800}`,
  passport: `https://images.unsplash.com/photo-1488646953014-85cb44e25828${W800}`,
  travel: `https://images.unsplash.com/photo-1436498593335-71c7b98a3363${W800}`,
  embassy: `https://images.unsplash.com/photo-1589829545856-d10d557cf95f${W800}`,
  family: `https://images.unsplash.com/photo-1511895426328-dc8714191300${W800}`,
  citizenship: `https://images.unsplash.com/photo-1485871981521-5b1fd3805eee${W800}`,
  airplane: `https://images.unsplash.com/photo-1436498593335-71c7b98a3363${W800}`,
  statueOfLiberty: `https://images.unsplash.com/photo-1485871981521-5b1fd3805eee${W800}`,
  usFlag: `https://images.unsplash.com/photo-1524661135-423995f22d0b${W800}`,
  airport: `https://images.unsplash.com/photo-1540962351504-03099e0a754b${W800}`,
  capitol: `https://images.unsplash.com/photo-1555099962-4199c345e5dd${W800}`,
  documents: `https://images.unsplash.com/photo-1586281380349-632531db7ed4${W800}`,
} as const;

/** All news images for variety rotation — ensures different image per article */
export const NEWS_IMAGES_POOL = [
  NEWS_IMAGES.airplane,
  NEWS_IMAGES.statueOfLiberty,
  NEWS_IMAGES.usFlag,
  NEWS_IMAGES.passport,
  NEWS_IMAGES.visa,
  NEWS_IMAGES.embassy,
  NEWS_IMAGES.travel,
  NEWS_IMAGES.citizenship,
  NEWS_IMAGES.official,
  NEWS_IMAGES.airport,
  NEWS_IMAGES.capitol,
  NEWS_IMAGES.family,
  NEWS_IMAGES.documents,
  NEWS_IMAGES.law,
  NEWS_IMAGES.professional,
] as const;

/** Source-domain to image mapping — fits each resource/source name */
export const SOURCE_IMAGES: Record<string, string> = {
  "uscis.gov": NEWS_IMAGES.official,
  "www.uscis.gov": NEWS_IMAGES.official,
  "dhs.gov": NEWS_IMAGES.capitol,
  "www.dhs.gov": NEWS_IMAGES.capitol,
  "travel.state.gov": NEWS_IMAGES.passport,
  "state.gov": NEWS_IMAGES.embassy,
  "npr.org": NEWS_IMAGES.usFlag,
  "reuters.com": NEWS_IMAGES.documents,
  "apnews.com": NEWS_IMAGES.usFlag,
  "bbc.com": NEWS_IMAGES.airplane,
  "nytimes.com": NEWS_IMAGES.statueOfLiberty,
  "washingtonpost.com": NEWS_IMAGES.capitol,
  "theguardian.com": NEWS_IMAGES.travel,
  "boundless.com": NEWS_IMAGES.family,
  "timesofindia.indiatimes.com": NEWS_IMAGES.visa,
  "aila.org": NEWS_IMAGES.law,
  "immigrationimpact.com": NEWS_IMAGES.citizenship,
};

/** Custom image for "This Week in Immigration" (Boundless) — urban movement/immigration theme */
export const BOUNDLESS_WEEKLY_IMAGE = "/images/news/boundless-immigration.png";

const W400 = "?w=400&q=85";
const W600 = "?w=600&q=85";
const W96 = "?w=96&q=90";

/** Tiny icon images — replace small SVG icons (use in w-8 to w-12 containers) */
export const ICON_IMAGES = {
  documents: `https://images.unsplash.com/photo-1554224155-6726b3ff858f${W96}`,
  office: `https://images.unsplash.com/photo-1454165804606-c3d57bc86b40${W96}`,
  passport: `https://images.unsplash.com/photo-1488646953014-85cb44e25828${W96}`,
  family: `https://images.unsplash.com/photo-1511895426328-dc8714191300${W96}`,
  checklist: `https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d${W96}`,
  calendar: `https://images.unsplash.com/photo-1506784365847-bbad939e9335${W96}`,
  embassy: `https://images.unsplash.com/photo-1589829545856-d10d557cf95f${W96}`,
  hands: `https://images.unsplash.com/photo-1586281380349-632531db7ed4${W96}`,
  globe: `https://images.unsplash.com/photo-1488646953014-85cb44e25828${W96}`,
  chart: `https://images.unsplash.com/photo-1551288049-bebda4e38f71${W96}`,
  forms: `https://images.unsplash.com/photo-1586281380349-632531db7ed4${W96}`,
  tools: `https://images.unsplash.com/photo-1454165804606-c3d57bc86b40${W96}`,
  sparkles: `https://images.unsplash.com/photo-1511895426328-dc8714191300${W96}`,
  money: `https://images.unsplash.com/photo-1563013544-824ae1b704d3${W96}`,
  bell: `https://images.unsplash.com/photo-1506784365847-bbad939e9335${W96}`,
  shield: `https://images.unsplash.com/photo-1589829545856-d10d557cf95f${W96}`,
  newspaper: `https://images.unsplash.com/photo-1504711434969-e33886168f5c${W96}`,
  search: `https://images.unsplash.com/photo-1454165804606-c3d57bc86b40${W96}`,
  user: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d${W96}`,
  lock: `https://images.unsplash.com/photo-1614064548237-096ae9f61b36${W96}`,
  check: `https://images.unsplash.com/photo-1586281380349-632531db7ed4${W96}`,
  warning: `https://images.unsplash.com/photo-1554224155-6726b3ff858f${W96}`,
  folder: `https://images.unsplash.com/photo-1554224155-6726b3ff858f${W96}`,
  lightning: `https://images.unsplash.com/photo-1551288049-bebda4e38f71${W96}`,
} as const;

/** Section/card background images — for content cards, section accents */
export const SECTION_IMAGES = {
  documents: `https://images.unsplash.com/photo-1554224155-6726b3ff858f${W600}`,
  office: `https://images.unsplash.com/photo-1454165804606-c3d57bc86b40${W600}`,
  passport: `https://images.unsplash.com/photo-1488646953014-85cb44e25828${W600}`,
  family: `https://images.unsplash.com/photo-1511895426328-dc8714191300${W600}`,
  checklist: `https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d${W600}`,
  calendar: `https://images.unsplash.com/photo-1506784365847-bbad939e9335${W600}`,
  embassy: `https://images.unsplash.com/photo-1589829545856-d10d557cf95f${W600}`,
  hands: `https://images.unsplash.com/photo-1586281380349-632531db7ed4${W600}`,
} as const;

/** Tool/premium pill images — for Case Tools, Expedite, Action Plan cards */
export const TOOL_PILL_IMAGES = {
  caseTools: HERO_IMAGES.documents,
  expedite: HERO_IMAGES.handsDocuments,
  actionPlan: HERO_IMAGES.familyTravel,
} as const;

/** Tool card images — for individual tool links (RFE, Document Pack, etc.) */
export const TOOL_CARD_IMAGES: Record<string, string> = {
  "RFE/NOID Response": HERO_IMAGES.handsDocuments,
  "Document Pack Organizer": HERO_IMAGES.documents,
  "Timeline Alerts & Reminders": HERO_IMAGES.calendar,
  "Evidence Checklist Builder": HERO_IMAGES.checklist,
};

/** Country-specific diagram/flow images for Action Plan (Travel.State.Gov style) */
export const COUNTRY_DIAGRAM_IMAGES: Record<string, string> = {
  India: `https://images.unsplash.com/photo-1524492419099-c14843f6f6aa${W600}`,
  Pakistan: `https://images.unsplash.com/photo-1548013146-7247f65966a4${W600}`,
  Philippines: `https://images.unsplash.com/photo-1559164609-a66f3d0cb1ad${W600}`,
  Bangladesh: `https://images.unsplash.com/photo-1547471080-7cc2caa01a7e${W600}`,
  Nepal: `https://images.unsplash.com/photo-1544735716-392fe2489ffa${W600}`,
  Mexico: `https://images.unsplash.com/photo-1518639192441-8fce0a366e2e${W600}`,
  China: `https://images.unsplash.com/photo-1508804185872-d7badad00f7d${W600}`,
  Nigeria: `https://images.unsplash.com/photo-1489392191049-fc10c97e64b6${W600}`,
  "United Kingdom": `https://images.unsplash.com/photo-1513635269975-59663e0ac1ad${W600}`,
  Canada: `https://images.unsplash.com/photo-1519832979-6fa011b87667${W600}`,
  "Sri Lanka": `https://images.unsplash.com/photo-1583863788434-e58a36330cf0${W600}`,
  Vietnam: `https://images.unsplash.com/photo-1528127269322-539801943592${W600}`,
  Colombia: `https://images.unsplash.com/photo-1551698618-1dfe5d97d256${W600}`,
  Brazil: `https://images.unsplash.com/photo-1483729558449-99ef09a8c325${W600}`,
};

/** Default image when no country-specific image exists */
export const DEFAULT_DIAGRAM_IMAGE = SECTION_IMAGES.embassy;

/** Empty state illustrations — when no data/results */
export const EMPTY_STATE_IMAGES = {
  search: HERO_IMAGES.documents,
  documents: HERO_IMAGES.handsDocuments,
  news: HERO_IMAGES.passport,
  guides: HERO_IMAGES.office,
  profile: HERO_IMAGES.familyTravel,
} as const;

/** Resource card images — each matches the resource name and purpose */
export const RESOURCE_IMAGES: Record<string, string> = {
  "USCIS Case Status": `https://images.unsplash.com/photo-1586281380349-632531db7ed4${W400}`,
  "Processing Times": `https://images.unsplash.com/photo-1507679799987-c73779587ccf${W400}`,
  "Fee Calculator": `https://images.unsplash.com/photo-1563013544-824ae1b704d3${W400}`,
  "Status Decoder": `https://images.unsplash.com/photo-1450101499163-c8848c66ca85${W400}`,
  "Form Guides": `https://images.unsplash.com/photo-1512820790803-83ca734da794${W400}`,
  "Help Center": `https://images.unsplash.com/photo-1523240795612-9a054b0db644${W400}`,
  "Processing Statistics": `https://images.unsplash.com/photo-1551288049-bebda4e38f71${W400}`,
  "Official Links": `https://images.unsplash.com/photo-1454165804606-c3d57bc86b40${W400}`,
  "Embassy Finder": `https://images.unsplash.com/photo-1589829545856-d10d557cf95f${W400}`,
  "Travel Advisories": `https://images.unsplash.com/photo-1488646953014-85cb44e25828${W400}`,
};
