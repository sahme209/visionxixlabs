"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { InlineHelp } from "@/components/Tooltip";
import FormIcon from "@/components/FormIcon";
import { analytics } from "@/lib/analytics";
import { HERO_IMAGES } from "@/lib/images";
import { fetchCaseStatus, USCISCaseStatusResponse, CaseStatusError, mapUSCISErrorToFriendly } from "@/lib/services/uscisStatusService";

const FORM_TYPES = ["I-130", "I-129F", "I-485", "I-765", "N-400"];

// Helper function to get all countries using Intl API (similar to iOS Locale.isoRegionCodes)
const getAllCountries = (): string[] => {
  if (typeof window === "undefined") {
    // Server-side: return popular countries as fallback
    return [
      "India",
      "China",
      "Philippines",
      "Mexico",
      "Pakistan",
      "Bangladesh",
      "Brazil",
      "Colombia",
      "Dominican Republic",
      "Haiti",
      "Jamaica",
      "Nigeria",
      "South Korea",
      "Vietnam",
      "Other",
    ];
  }
  
  // Client-side: use Intl API to get all countries
  const countries: string[] = [];
  const countryCodes = [
    "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
    "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ",
    "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ",
    "DE", "DJ", "DK", "DM", "DO", "DZ",
    "EC", "EE", "EG", "EH", "ER", "ES", "ET",
    "FI", "FJ", "FK", "FM", "FO", "FR",
    "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY",
    "HK", "HM", "HN", "HR", "HT", "HU",
    "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT",
    "JE", "JM", "JO", "JP",
    "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ",
    "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
    "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
    "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ",
    "OM",
    "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY",
    "QA",
    "RE", "RO", "RS", "RU", "RW",
    "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ",
    "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ",
    "UA", "UG", "UM", "US", "UY", "UZ",
    "VA", "VC", "VE", "VG", "VI", "VN", "VU",
    "WF", "WS",
    "YE", "YT",
    "ZA", "ZM", "ZW"
  ];
  
  for (const code of countryCodes) {
    try {
      const displayName = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      if (displayName) {
        countries.push(displayName);
      }
    } catch (e) {
      // Skip invalid codes
    }
  }
  
  // Sort alphabetically
  return countries.sort((a, b) => a.localeCompare(b));
};

// Initialize COUNTRIES array (will be populated on client-side)
let COUNTRIES = getAllCountries();

// Fallback embassy list (used if Firebase fetch fails)
// Note: Empty string is handled separately in the select dropdown
const US_EMBASSIES_FALLBACK = [
  "Abidjan, Côte d'Ivoire",
  "Abu Dhabi, UAE",
  "Accra, Ghana",
  "Addis Ababa, Ethiopia",
  "Algiers, Algeria",
  "Amman, Jordan",
  "Amsterdam, Netherlands",
  "Ankara, Turkey",
  "Asuncion, Paraguay",
  "Athens, Greece",
  "Baghdad, Iraq",
  "Baku, Azerbaijan",
  "Bamako, Mali",
  "Bangkok, Thailand",
  "Banjul, Gambia",
  "Beijing, China",
  "Beirut, Lebanon",
  "Belgrade, Serbia",
  "Berlin, Germany",
  "Bern, Switzerland",
  "Bishkek, Kyrgyzstan",
  "Bogota, Colombia",
  "Brasilia, Brazil",
  "Bratislava, Slovakia",
  "Bridgetown, Barbados",
  "Brussels, Belgium",
  "Bucharest, Romania",
  "Budapest, Hungary",
  "Buenos Aires, Argentina",
  "Cairo, Egypt",
  "Canberra, Australia",
  "Caracas, Venezuela",
  "Casablanca, Morocco",
  "Chisinau, Moldova",
  "Colombo, Sri Lanka",
  "Conakry, Guinea",
  "Copenhagen, Denmark",
  "Dakar, Senegal",
  "Damascus, Syria",
  "Dar es Salaam, Tanzania",
  "Dhaka, Bangladesh",
  "Doha, Qatar",
  "Dublin, Ireland",
  "Dushanbe, Tajikistan",
  "Freetown, Sierra Leone",
  "Georgetown, Guyana",
  "Guatemala City, Guatemala",
  "Hanoi, Vietnam",
  "Harare, Zimbabwe",
  "Havana, Cuba",
  "Helsinki, Finland",
  "Ho Chi Minh City, Vietnam",
  "Islamabad, Pakistan",
  "Jakarta, Indonesia",
  "Kabul, Afghanistan",
  "Kampala, Uganda",
  "Kathmandu, Nepal",
  "Khartoum, Sudan",
  "Kiev, Ukraine",
  "Kigali, Rwanda",
  "Kingston, Jamaica",
  "Kinshasa, DRC",
  "Kuala Lumpur, Malaysia",
  "Kuwait City, Kuwait",
  "Lagos, Nigeria",
  "Lima, Peru",
  "Lisbon, Portugal",
  "Ljubljana, Slovenia",
  "London, UK",
  "Luanda, Angola",
  "Lusaka, Zambia",
  "Madrid, Spain",
  "Managua, Nicaragua",
  "Manila, Philippines",
  "Maputo, Mozambique",
  "Mexico City, Mexico",
  "Minsk, Belarus",
  "Monrovia, Liberia",
  "Montevideo, Uruguay",
  "Moscow, Russia",
  "Mumbai, India",
  "Muscat, Oman",
  "Nairobi, Kenya",
  "New Delhi, India",
  "Nicosia, Cyprus",
  "Nur-Sultan, Kazakhstan",
  "Oslo, Norway",
  "Ottawa, Canada",
  "Panama City, Panama",
  "Paramaribo, Suriname",
  "Paris, France",
  "Phnom Penh, Cambodia",
  "Port-au-Prince, Haiti",
  "Port Louis, Mauritius",
  "Prague, Czech Republic",
  "Pretoria, South Africa",
  "Quito, Ecuador",
  "Rabat, Morocco",
  "Reykjavik, Iceland",
  "Riga, Latvia",
  "Riyadh, Saudi Arabia",
  "Rome, Italy",
  "San Jose, Costa Rica",
  "San Salvador, El Salvador",
  "Santiago, Chile",
  "Santo Domingo, Dominican Republic",
  "Sarajevo, Bosnia and Herzegovina",
  "Seoul, South Korea",
  "Singapore, Singapore",
  "Skopje, North Macedonia",
  "Sofia, Bulgaria",
  "Stockholm, Sweden",
  "Sucre, Bolivia",
  "Taipei, Taiwan",
  "Tallinn, Estonia",
  "Tashkent, Uzbekistan",
  "Tegucigalpa, Honduras",
  "Tehran, Iran",
  "Tel Aviv, Israel",
  "The Hague, Netherlands",
  "Tirana, Albania",
  "Tokyo, Japan",
  "Tunis, Tunisia",
  "Ulaanbaatar, Mongolia",
  "Vienna, Austria",
  "Vientiane, Laos",
  "Vilnius, Lithuania",
  "Warsaw, Poland",
  "Wellington, New Zealand",
  "Yaounde, Cameroon",
  "Yerevan, Armenia",
  "Zagreb, Croatia",
  "Praia, Cape Verde",
  "Apia, Samoa",
  "Basseterre, Saint Kitts and Nevis",
  "Belmopan, Belize",
  "Bissau, Guinea-Bissau",
  "Brazzaville, Republic of the Congo",
  "Bujumbura, Burundi",
  "Castries, Saint Lucia",
  "Djibouti, Djibouti",
  "Gaborone, Botswana",
  "Kingstown, Saint Vincent and the Grenadines",
  "Libreville, Gabon",
  "Lilongwe, Malawi",
  "Lome, Togo",
  "Luxembourg, Luxembourg",
  "Malabo, Equatorial Guinea",
  "Maseru, Lesotho",
  "Mbabane, Eswatini",
  "Nassau, The Bahamas",
  "N'Djamena, Chad",
  "Niamey, Niger",
  "Nouakchott, Mauritania",
  "Nuku'alofa, Tonga",
  "Ouagadougou, Burkina Faso",
  "Port Moresby, Papua New Guinea",
  "Port of Spain, Trinidad and Tobago",
  "Porto Novo, Benin",
  "Roseau, Dominica",
  "San Marino, San Marino",
  "Sana'a, Yemen",
  "Sao Tome, Sao Tome and Principe",
  "St. George's, Grenada",
  "St. John's, Antigua and Barbuda",
  "Suva, Fiji",
  "Tarawa, Kiribati",
  "Thimphu, Bhutan",
  "Tripoli, Libya",
  "Valletta, Malta",
  "Vaduz, Liechtenstein",
  "Windhoek, Namibia",
  "Yamoussoukro, Côte d'Ivoire",
];

interface ProfileData {
  formType: string;
  priorityDate: string; // For I-130/I-129F: Priority Date; For I-485/I-765/N-400: USCIS Received Date
  country?: string; // For I-130/I-129F only
  receiptNumber?: string;
  serviceCenter?: string; // For I-130 only
  processingPath?: "Consular" | "AOS"; // For I-130 only
  relationshipCategory?: string; // For I-130 only
  
  // I-129F specific
  usEmbassy?: string; // U.S. Embassy (required for I-129F)
  hasRFE?: boolean; // RFE toggle
  rfeNoticeDate?: string; // RFE notice date
  rfeResponseDate?: string; // RFE response date
  
  // I-485 specific
  i485Category?: string; // Filing category (Asylum, Cuban, Employment, Family, Other, Refugee)
  alsoTrackingI765?: boolean; // Also tracking I-765
  alsoTrackingI131?: boolean; // Also tracking I-131
  
  // I-765 specific
  linkedToI485?: boolean; // Linked to I-485?
  
  completed: boolean;
}

function ProfileSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [formType, setFormType] = useState("");
  const [priorityDate, setPriorityDate] = useState("");
  const [country, setCountry] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [caseStatus, setCaseStatus] = useState<USCISCaseStatusResponse | null>(null);
  const [caseStatusLoading, setCaseStatusLoading] = useState(false);
  const [caseStatusError, setCaseStatusError] = useState<string | null>(null);

  // Function to fetch case status for receipt number
  const fetchCaseStatusForReceipt = async (receipt: string) => {
    if (!receipt || receipt.length !== 13) {
      setCaseStatus(null);
      setCaseStatusError(null);
      return;
    }

    setCaseStatusLoading(true);
    setCaseStatusError(null);
    setCaseStatus(null);

    try {
      const result = await fetchCaseStatus(receipt);
      setCaseStatus(result);
      setCaseStatusError(null);
    } catch (err: any) {
      const error = err as CaseStatusError;
      const friendly = mapUSCISErrorToFriendly(error.message || "Unknown error");
      setCaseStatusError(friendly.message);
      setCaseStatus(null);
    } finally {
      setCaseStatusLoading(false);
    }
  };
  const [serviceCenter, setServiceCenter] = useState("");
  const [processingPath, setProcessingPath] = useState<"Consular" | "AOS">("Consular");
  const [relationshipCategory, setRelationshipCategory] = useState("");
  
  // I-129F specific
  const [usEmbassy, setUsEmbassy] = useState("");
  const [hasRFE, setHasRFE] = useState(false);
  const [rfeNoticeDate, setRfeNoticeDate] = useState("");
  const [rfeResponseDate, setRfeResponseDate] = useState("");
  
  // I-485 specific
  const [i485Category, setI485Category] = useState("");
  const [alsoTrackingI765, setAlsoTrackingI765] = useState(false);
  const [alsoTrackingI131, setAlsoTrackingI131] = useState(false);
  
  // I-765 specific
  const [linkedToI485, setLinkedToI485] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [profileStatus, setProfileStatus] = useState<"idle" | "auth-loading" | "profile-loading" | "ready" | "missing" | "error">("idle");
  
  // State for all countries (loaded dynamically)
  const [allCountries, setAllCountries] = useState<string[]>(COUNTRIES);

  // Anonymous sign-in for profile setup without sign-up prompt
  const [anonError, setAnonError] = useState<string | null>(null);
  const [anonAttempted, setAnonAttempted] = useState(false);

  // Check if this is edit mode (from pencil icon or query param)
  const isEditMode = searchParams.get("edit") === "true" || searchParams.get("mode") === "edit";
  
  // Load all countries on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const countries = getAllCountries();
      setAllCountries(countries);
    }
  }, []);

  // When not signed in, sign in anonymously so user can complete profile without sign-up prompt
  useEffect(() => {
    if (user || authLoading || anonAttempted || anonError) return;
    setAnonAttempted(true);
    signInAnonymously(auth)
      .catch((err) => {
        console.error("Anonymous sign-in failed:", err);
        setAnonError(err?.message || "Could not continue. Please sign in.");
      });
  }, [user, authLoading, anonAttempted, anonError]);


  useEffect(() => {
    // State machine for profile loading
    if (authLoading) {
      setProfileStatus("auth-loading");
      return;
    }

    if (!user) {
      setProfileStatus("idle");
      return;
    }

    // IMPORTANT: If in edit mode, NEVER redirect - always show the form
    if (isEditMode) {
      setProfileStatus("profile-loading");
      const profileRef = doc(db, "userProfiles", user.uid);
      getDoc(profileRef)
        .then((profileSnap) => {
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            setFormType(data.formType || "");
            setPriorityDate(data.priorityDate || "");
            setCountry(data.country || "");
            const receipt = data.receiptNumber || "";
            setReceiptNumber(receipt);
            // Auto-fetch case status if receipt number exists
            if (receipt && receipt.length === 13) {
              fetchCaseStatusForReceipt(receipt);
            }
            setServiceCenter(data.serviceCenter || "");
            setProcessingPath(data.processingPath || "Consular");
            setRelationshipCategory(data.relationshipCategory || "");
            
            // I-129F specific
            setUsEmbassy(data.usEmbassy || "");
            setHasRFE(data.hasRFE || false);
            setRfeNoticeDate(data.rfeNoticeDate || "");
            setRfeResponseDate(data.rfeResponseDate || "");
            
            // I-485 specific
            setI485Category(data.i485Category || "");
            setAlsoTrackingI765(data.alsoTrackingI765 || false);
            setAlsoTrackingI131(data.alsoTrackingI131 || false);
            
            // I-765 specific
            setLinkedToI485(data.linkedToI485 || false);
            
            // In edit mode, always show the form - never redirect
            setProfileStatus("missing");
          } else {
            setProfileStatus("missing");
          }
        })
        .catch((error) => {
          console.error("Error loading profile:", error);
          setProfileStatus("error");
        });
      return;
    }

    // User is authenticated, load profile (only if NOT in edit mode)
    setProfileStatus("profile-loading");
    
    const timeoutId = setTimeout(() => {
      setProfileStatus("error");
    }, 12000); // 12 second timeout

    const profileRef = doc(db, "userProfiles", user.uid);
    getDoc(profileRef)
      .then((profileSnap) => {
        clearTimeout(timeoutId);
        
        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setFormType(data.formType || "");
          setPriorityDate(data.priorityDate || "");
          setCountry(data.country || "");
          setReceiptNumber(data.receiptNumber || "");
          setServiceCenter(data.serviceCenter || "");
          setProcessingPath(data.processingPath || "Consular");
          setRelationshipCategory(data.relationshipCategory || "");
          setUsEmbassy(data.usEmbassy || "");
          setHasRFE(data.hasRFE || false);
          setRfeNoticeDate(data.rfeNoticeDate || "");
          setRfeResponseDate(data.rfeResponseDate || "");
          setI485Category(data.i485Category || "");
          setAlsoTrackingI765(data.alsoTrackingI765 || false);
          setAlsoTrackingI131(data.alsoTrackingI131 || false);
          setLinkedToI485(data.linkedToI485 || false);
          
          // Show the form regardless of completion status
          // This allows users to view/edit their profile even if it's already completed
          localStorage.setItem("profileSetupCompleted", "true");
          setProfileStatus("missing");
        } else {
          setProfileStatus("missing");
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error("Error loading profile:", error);
        setProfileStatus("error");
      });

    // Cleanup timeout on unmount or dependency change
    return () => {
      clearTimeout(timeoutId);
    };
  }, [user, authLoading, router, isEditMode]);

  const handleFormTypeChange = (type: string) => {
    setFormType(type);
    // Reset form-specific fields when form type changes
    if (type !== "I-130" && type !== "I-129F") {
      setCountry("");
    }
    if (type !== "I-129F") {
      setUsEmbassy("");
      setHasRFE(false);
      setRfeNoticeDate("");
      setRfeResponseDate("");
    }
    if (type !== "I-485") {
      setI485Category("");
      setAlsoTrackingI765(false);
      setAlsoTrackingI131(false);
    }
    if (type !== "I-765") {
      setLinkedToI485(false);
    }
    if (type !== "I-130") {
      setProcessingPath("Consular");
      setRelationshipCategory("");
      setServiceCenter("");
    }
  };

  const handleSubmit = async () => {
    console.log("[handleSubmit] Starting submission...");
    console.log("[handleSubmit] user:", user?.uid);
    console.log("[handleSubmit] formType:", formType);
    console.log("[handleSubmit] priorityDate:", priorityDate);
    console.log("[handleSubmit] receiptNumber:", receiptNumber);
    
    // Validate required fields
    if (!user || !receiptNumber || receiptNumber.trim() === "" || receiptNumber.length !== 13) {
      console.error("[handleSubmit] Missing receipt number");
      alert("Please enter a valid 13-character receipt number");
      return;
    }
    
    if (!formType || !priorityDate || priorityDate.trim() === "") {
      console.error("[handleSubmit] Missing basic fields");
      alert("Please fill in all required fields");
      return;
    }
    
    // Form-specific validation
    if (formType === "I-130" && (!country || country.trim() === "")) {
      console.error("[handleSubmit] I-130 missing country");
      alert("Please select your country of origin");
      return;
    }
    
    if (formType === "I-129F" && (!usEmbassy || usEmbassy.trim() === "")) {
      console.error("[handleSubmit] I-129F missing U.S. Embassy");
      alert("Please enter your U.S. Embassy location");
      return;
    }
    
    if (formType === "I-485" && (!i485Category || i485Category.trim() === "")) {
      console.error("[handleSubmit] I-485 missing category");
      alert("Please select your I-485 filing category");
      return;
    }

    if (!acceptedTerms) {
      console.error("[handleSubmit] Terms not accepted");
      alert("Please accept the Privacy Policy and Terms of Service to continue");
      return;
    }
    
    console.log("[handleSubmit] Validation passed, saving profile...");

    setLoading(true);
    try {
      // Build profile data object, only including defined fields (Firestore doesn't allow undefined)
      const profileData: any = {
        formType,
        priorityDate,
        receiptNumber: receiptNumber.trim().toUpperCase(),
        completed: true,
      };
      
      // I-130 and I-129F: Add country if provided
      if (formType === "I-130" || formType === "I-129F") {
        if (country && country.trim() !== "") {
          profileData.country = country;
        }
      }
      
      // I-130 specific fields
      if (formType === "I-130") {
        if (processingPath) {
          profileData.processingPath = processingPath;
        }
        if (relationshipCategory && relationshipCategory.trim() !== "") {
          profileData.relationshipCategory = relationshipCategory;
        }
        if (serviceCenter && serviceCenter.trim() !== "") {
          profileData.serviceCenter = serviceCenter;
        }
      }
      
      // I-129F specific fields
      if (formType === "I-129F") {
        if (usEmbassy && usEmbassy.trim() !== "") {
          profileData.usEmbassy = usEmbassy;
        }
        profileData.hasRFE = hasRFE;
        if (hasRFE) {
          if (rfeNoticeDate && rfeNoticeDate.trim() !== "") {
            profileData.rfeNoticeDate = rfeNoticeDate;
          }
          if (rfeResponseDate && rfeResponseDate.trim() !== "") {
            profileData.rfeResponseDate = rfeResponseDate;
          }
        }
      }
      
      // I-485 specific fields
      if (formType === "I-485") {
        if (i485Category && i485Category.trim() !== "") {
          profileData.i485Category = i485Category;
        }
        profileData.alsoTrackingI765 = alsoTrackingI765;
        profileData.alsoTrackingI131 = alsoTrackingI131;
      }
      
      // I-765 specific fields
      if (formType === "I-765") {
        profileData.linkedToI485 = linkedToI485;
      }
      
      // Receipt number is now required and already included in profileData above

      console.log("[handleSubmit] Saving profile data:", profileData);
      await setDoc(doc(db, "userProfiles", user.uid), profileData, { merge: true });
      localStorage.setItem("profileSetupCompleted", "true");
      analytics.profileSetupCompleted(formType);
      
      // Fetch case status once (user won't need to press Check Status on home)
      const receipt = receiptNumber.trim().toUpperCase();
      try {
        const result = await fetchCaseStatus(receipt);
        sessionStorage.setItem("visanova_uscis_pending", JSON.stringify({
          receiptNumber: receipt,
          status: result,
          error: null,
        }));
      } catch (err: any) {
        const error = err as CaseStatusError;
        const friendly = mapUSCISErrorToFriendly(error.message || "Unknown error");
        sessionStorage.setItem("visanova_uscis_pending", JSON.stringify({
          receiptNumber: receipt,
          status: null,
          error: { title: friendly.title, message: friendly.message },
        }));
      }
      
      // Show nice success toast
      setShowSuccessToast(true);
      
      // Redirect to home after showing toast
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (profileStatus === "auth-loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
        <div className="text-center max-w-md space-y-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--uscis-blue)]"></div>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Show loading only when loading profile data
  if (profileStatus === "profile-loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
        <div className="text-center max-w-md space-y-4">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--uscis-blue)]"></div>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  // Show error state with retry - Better UX
  if (profileStatus === "error") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
        <div className="text-center max-w-md space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Unable to Load Your Profile
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              We couldn't load your profile data. This might be due to a network issue or temporary service problem.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                setProfileStatus("profile-loading");
                // Trigger re-fetch by updating a dependency
                const profileRef = doc(db, "userProfiles", user!.uid);
                getDoc(profileRef)
                  .then((profileSnap) => {
                    if (profileSnap.exists()) {
                      const data = profileSnap.data();
                      setFormType(data.formType || "");
                      setPriorityDate(data.priorityDate || "");
                      setCountry(data.country || "");
                      const receipt = data.receiptNumber || "";
                      setReceiptNumber(receipt);
                      // Auto-fetch case status if receipt number exists
                      if (receipt && receipt.length === 13) {
                        fetchCaseStatusForReceipt(receipt);
                      }
                      setServiceCenter(data.serviceCenter || "");
                      setProcessingPath(data.processingPath || "Consular");
                      setRelationshipCategory(data.relationshipCategory || "");
                      setUsEmbassy(data.usEmbassy || "");
                      setHasRFE(data.hasRFE || false);
                      setRfeNoticeDate(data.rfeNoticeDate || "");
                      setRfeResponseDate(data.rfeResponseDate || "");
                      setI485Category(data.i485Category || "");
                      setAlsoTrackingI765(data.alsoTrackingI765 || false);
                      setAlsoTrackingI131(data.alsoTrackingI131 || false);
                      setLinkedToI485(data.linkedToI485 || false);
                      // In edit mode, NEVER redirect - always show form
                      if (isEditMode) {
                        setProfileStatus("missing");
                      } else if (data.completed && !isEditMode) {
                        localStorage.setItem("profileSetupCompleted", "true");
                        setTimeout(() => router.push("/"), 100);
                        setProfileStatus("ready");
                      } else {
                        setProfileStatus("missing");
                      }
                    } else {
                      setProfileStatus("missing");
                    }
                  })
                  .catch((error) => {
                    console.error("Error loading profile:", error);
                    setProfileStatus("error");
                  });
              }}
              className="px-6 py-3 bg-[var(--uscis-blue)] text-white rounded-lg hover:bg-[var(--uscis-blue-dark)] transition-colors text-sm font-semibold shadow-lg hover:shadow-xl"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="px-6 py-3 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors text-sm font-semibold"
            >
              Go to Home
            </Link>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-4">
            If this problem continues, please check your internet connection or try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!user && profileStatus === "idle") {
    if (anonError) {
      return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
          <div className="text-center max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sign in to continue</h1>
            <p className="text-[var(--text-secondary)]">{anonError}</p>
            <a href="/login" className="inline-block uscis-button">Sign In</a>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[var(--uscis-blue)] border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-[var(--text-secondary)]">Setting up...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Success Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="bg-white dark:bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-color)] backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95 px-5 py-4 flex items-start gap-3 min-w-[300px] max-w-sm">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 pt-0.5">
              <p className="text-xs font-medium text-[var(--text-tertiary)] mb-0.5">visanova.app</p>
              <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight">Profile updated successfully!</p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.familyTravel} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative z-10 w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
          <h1 className="text-3xl font-bold mb-2 text-fg">
            Profile Setup
          </h1>
          <p className="text-sm text-muted">
            We use this to show your timeline and where you stand
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        <ProfileDetailsForm
          formType={formType}
          onFormTypeChange={handleFormTypeChange}
            priorityDate={priorityDate}
            country={country}
            receiptNumber={receiptNumber}
            serviceCenter={serviceCenter}
            processingPath={processingPath}
            relationshipCategory={relationshipCategory}
            usEmbassy={usEmbassy}
            hasRFE={hasRFE}
            allCountries={allCountries}
            rfeNoticeDate={rfeNoticeDate}
            rfeResponseDate={rfeResponseDate}
            i485Category={i485Category}
            alsoTrackingI765={alsoTrackingI765}
            alsoTrackingI131={alsoTrackingI131}
            linkedToI485={linkedToI485}
            onPriorityDateChange={setPriorityDate}
            onCountryChange={setCountry}
            onReceiptNumberChange={(newReceipt) => {
              setReceiptNumber(newReceipt);
              // Auto-fetch case status when receipt number is valid
              if (newReceipt && newReceipt.length === 13) {
                fetchCaseStatusForReceipt(newReceipt);
              } else {
                // Clear status if receipt number is invalid
                setCaseStatus(null);
                setCaseStatusError(null);
              }
            }}
            caseStatus={caseStatus}
            caseStatusLoading={caseStatusLoading}
            caseStatusError={caseStatusError}
            onServiceCenterChange={setServiceCenter}
            onProcessingPathChange={setProcessingPath}
            onRelationshipCategoryChange={setRelationshipCategory}
            onUsEmbassyChange={setUsEmbassy}
            onHasRFEChange={setHasRFE}
            onRfeNoticeDateChange={setRfeNoticeDate}
            onRfeResponseDateChange={setRfeResponseDate}
            onI485CategoryChange={setI485Category}
            onAlsoTrackingI765Change={setAlsoTrackingI765}
            onAlsoTrackingI131Change={setAlsoTrackingI131}
            onLinkedToI485Change={setLinkedToI485}
            onSubmit={handleSubmit}
            loading={loading}
            acceptedTerms={acceptedTerms}
            onAcceptedTermsChange={setAcceptedTerms}
          />
      </main>
    </div>
  );
}

function ProfileDetailsForm({
  formType,
  onFormTypeChange,
  priorityDate,
  country,
  receiptNumber,
  serviceCenter,
  processingPath,
  relationshipCategory,
  usEmbassy,
  hasRFE,
  allCountries,
  rfeNoticeDate,
  rfeResponseDate,
  i485Category,
  alsoTrackingI765,
  alsoTrackingI131,
  linkedToI485,
  onPriorityDateChange,
  onCountryChange,
  onReceiptNumberChange,
  caseStatus,
  caseStatusLoading,
  caseStatusError,
  onServiceCenterChange,
  onProcessingPathChange,
  onRelationshipCategoryChange,
  onUsEmbassyChange,
  onHasRFEChange,
  onRfeNoticeDateChange,
  onRfeResponseDateChange,
  onI485CategoryChange,
  onAlsoTrackingI765Change,
  onAlsoTrackingI131Change,
  onLinkedToI485Change,
  onSubmit,
  loading,
  acceptedTerms,
  onAcceptedTermsChange,
}: {
  formType: string;
  onFormTypeChange: (value: string) => void;
  priorityDate: string;
  country: string;
  receiptNumber: string;
  serviceCenter: string;
  processingPath: "Consular" | "AOS";
  relationshipCategory: string;
  usEmbassy: string;
  hasRFE: boolean;
  rfeNoticeDate: string;
  rfeResponseDate: string;
  i485Category: string;
  alsoTrackingI765: boolean;
  alsoTrackingI131: boolean;
  linkedToI485: boolean;
  allCountries: string[];
  onPriorityDateChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onReceiptNumberChange: (value: string) => void;
  caseStatus?: USCISCaseStatusResponse | null;
  caseStatusLoading?: boolean;
  caseStatusError?: string | null;
  onServiceCenterChange: (value: string) => void;
  onProcessingPathChange: (value: "Consular" | "AOS") => void;
  onRelationshipCategoryChange: (value: string) => void;
  onUsEmbassyChange: (value: string) => void;
  onHasRFEChange: (value: boolean) => void;
  onRfeNoticeDateChange: (value: string) => void;
  onRfeResponseDateChange: (value: string) => void;
  onI485CategoryChange: (value: string) => void;
  onAlsoTrackingI765Change: (value: boolean) => void;
  onAlsoTrackingI131Change: (value: boolean) => void;
  onLinkedToI485Change: (value: boolean) => void;
  onSubmit: () => void;
  loading: boolean;
  acceptedTerms: boolean;
  onAcceptedTermsChange: (value: boolean) => void;
}) {
  // Fetch embassies from Firebase when I-129F is selected
  const [fetchedEmbassies, setFetchedEmbassies] = useState<string[]>([]);
  
  useEffect(() => {
    if (formType === "I-129F" && fetchedEmbassies.length === 0) {
      const fetchEmbassies = async () => {
        try {
          const snapshot = await getDocs(collection(db, "i129fEmbassyStats"));
          const embassies: string[] = []; // Don't include empty string - we add it separately in the select
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            const docId = doc.id;
            
            // Skip "global" document
            if (docId === "global") return;
            
            // Try to construct embassy name from Firebase structure
            if (data.countryName && data.embassyCity) {
              // New format: "embassyCity, countryName"
              embassies.push(`${data.embassyCity}, ${data.countryName}`);
            } else {
              // Fallback: use document ID as embassy name (for old format)
              embassies.push(docId);
            }
          });
          
          // Sort alphabetically
          const sorted = embassies.sort();
          setFetchedEmbassies(sorted);
          
          console.log(`[ProfileSetup] ✅ Fetched ${sorted.length} embassies from Firebase`);
        } catch (error) {
          console.error("[ProfileSetup] ❌ Error fetching embassies:", error);
          // Use fallback list on error (filter out empty string)
          setFetchedEmbassies(US_EMBASSIES_FALLBACK.filter(e => e !== ""));
        }
      };
      
      fetchEmbassies();
    }
  }, [formType, fetchedEmbassies.length]);
  // Import AOS calculator for I-485 categories
  const { getI485CategoryOptions } = require("@/lib/services/aosTimelineCalculator");
  const i485Categories = getI485CategoryOptions();
  
  const relationshipCategories = ["Spouse", "Parent", "Child", "Sibling"];
  
  // Determine if form requires country field
  const requiresCountry = formType === "I-130" || formType === "I-129F";
  
  // Determine date field label
  const getDateFieldLabel = () => {
    switch (formType) {
      case "I-130":
        return "Priority Date";
      case "I-129F":
        return "NOA1 (Receipt Date) / Priority Date";
      case "I-485":
      case "I-765":
      case "N-400":
        return "USCIS Received Date";
      default:
        return "Priority Date";
    }
  };
  
  // Get date field subtitle
  const getDateFieldSubtitle = () => {
    switch (formType) {
      case "I-130":
        return "The date USCIS received your petition (shown on I-797 receipt notice)";
      case "I-129F":
        return "The receipt date on your NOA1 (I-797C)";
      case "I-485":
      case "I-765":
      case "N-400":
        return "The receipt date on your I-797C";
      default:
        return "The date USCIS received your petition";
    }
  };
  
  // Check if form is valid for submission
  const isFormValid = () => {
    // Priority date is required for all forms
    if (!priorityDate || priorityDate.trim() === "") {
      console.log("[FormValidation] Missing priority date");
      return false;
    }
    
    // Form-specific required fields
    if (formType === "I-130") {
      if (!country || country.trim() === "") {
        console.log("[FormValidation] I-130 missing country");
        return false;
      }
    }
    
    if (formType === "I-129F") {
      if (!usEmbassy || usEmbassy.trim() === "") {
        console.log("[FormValidation] I-129F missing U.S. Embassy");
        return false;
      }
    }
    
    if (formType === "I-485") {
      if (!i485Category || i485Category.trim() === "") {
        console.log("[FormValidation] I-485 missing category");
        return false;
      }
    }
    
    // Terms acceptance is required for all forms
    if (!acceptedTerms) {
      console.log("[FormValidation] Terms not accepted");
      return false;
    }
    
    console.log("[FormValidation] Form is valid!");
    return true;
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-color)] shadow-sm p-6 space-y-6">
        {/* Receipt Number - Required - Moved above Form Type */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
            Receipt Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={receiptNumber}
            onChange={(e) => {
              const newValue = e.target.value.toUpperCase().trim();
              onReceiptNumberChange(newValue);
            }}
            placeholder="Example: MSC2390123456"
            maxLength={13}
            className="w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all font-mono"
            required
          />
          <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            💡 Your receipt number is a 13-character code (3 letters + 10 numbers) shown on your I-797 receipt notice
          </p>
        </div>

        {/* Form Type Selection */}
        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
            Form Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {FORM_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onFormTypeChange(type)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  formType === type
                    ? "border-[var(--uscis-blue)] bg-[var(--uscis-blue)]/10"
                    : "border-[var(--border-color)] hover:border-[var(--uscis-blue)]/50 bg-[var(--bg-surface-alt)]"
                }`}
              >
                <FormIcon formId={type} size={32} />
                <span className="text-xs font-semibold text-[var(--text-primary)]">{type}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            Choose the immigration form you&apos;re tracking
          </p>
        </div>
        
        {/* Date Field (Priority Date / USCIS Received Date) - Only show if form type is selected */}
        {formType && (
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5 flex items-center gap-2">
              {getDateFieldLabel()} <span className="text-red-500">*</span>
              <InlineHelp 
                term=""
                explanation={`${getDateFieldLabel()} is the date when USCIS officially received your case. You can find this date on your I-797 receipt notice (the letter USCIS sent you after receiving your application). It's usually in MM/DD/YYYY format at the top or bottom of the notice.`}
                className="!gap-0"
              />
            </label>
            <input
              type="date"
              value={priorityDate}
              onChange={(e) => onPriorityDateChange(e.target.value)}
              className="w-full max-w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all text-base"
              style={{ WebkitAppearance: 'none', appearance: 'none' }}
              required
            />
            <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
              {getDateFieldSubtitle()}
            </p>
            <p className="mt-1.5 text-xs text-[var(--text-tertiary)] italic">
              💡 Tip: Look for "Received Date" or "Priority Date" on your I-797 receipt notice
            </p>
          </div>
        )}
        
        {/* Form-Specific Fields - Only show if form type is selected */}
        {formType && (
          <>
            {formType === "I-130" && (
              <>
                {/* Country */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
                    Country of Origin <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={country}
                    onChange={(e) => onCountryChange(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all"
                    required
                  >
                    <option value="">Select a country</option>
                    {allCountries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Relationship/Category */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
                    Relationship/Category (Optional)
                  </label>
                  <select
                    value={relationshipCategory}
                    onChange={(e) => onRelationshipCategoryChange(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all"
                  >
                    <option value="">Select relationship</option>
                    {relationshipCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Service Center */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5 flex items-center gap-2">
                    Service Center (Optional)
                    <InlineHelp 
                      term=""
                      explanation="The service center is the USCIS office processing your case. You can find it on your I-797 receipt notice - look for a 3-letter code at the start of your receipt number (like MSC, WAC, LIN, EAC, SRC, etc.). MSC = Missouri/NBC, WAC = California, LIN = Nebraska, EAC = Vermont, SRC = Texas."
                      className="!gap-0"
                    />
                  </label>
                  <select
                    value={serviceCenter}
                    onChange={(e) => onServiceCenterChange(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all"
                  >
                    <option value="">Select service center (or leave blank)</option>
                    <option value="California">California (WAC)</option>
                    <option value="Texas">Texas (SRC)</option>
                    <option value="Nebraska">Nebraska (LIN)</option>
                    <option value="Vermont">Vermont (EAC)</option>
                    <option value="Potomac">Potomac (YSC)</option>
                    <option value="Missouri">Missouri/NBC (MSC)</option>
                  </select>
                  <p className="mt-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                    💡 Don't worry if you're not sure - this helps us give you more accurate estimates but isn't required
                  </p>
                </div>
                
                {/* Processing Path */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
                    Processing Path <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onProcessingPathChange("Consular")}
                      className={`flex-1 px-4 py-3 rounded-xl border transition-all font-semibold ${
                        processingPath === "Consular"
                          ? "bg-[var(--uscis-blue)] text-white border-[var(--uscis-blue)]"
                          : "bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      Consular
                    </button>
                    <button
                      type="button"
                      onClick={() => onProcessingPathChange("AOS")}
                      className={`flex-1 px-4 py-3 rounded-xl border transition-all font-semibold ${
                        processingPath === "AOS"
                          ? "bg-[var(--uscis-blue)] text-white border-[var(--uscis-blue)]"
                          : "bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      AOS
                    </button>
                  </div>
                </div>
              </>
            )}
            
            {formType === "I-129F" && (
              <>
                {/* U.S. Embassy */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
                    U.S. Embassy <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={usEmbassy}
                    onChange={(e) => onUsEmbassyChange(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all"
                    required
                  >
                    <option value="">Select a U.S. Embassy</option>
                    {(() => {
                      const embassyList = fetchedEmbassies.length > 0 ? fetchedEmbassies : US_EMBASSIES_FALLBACK;
                      return embassyList
                        .filter(embassy => embassy !== "") // Filter out empty option if it exists
                        .map((embassy) => (
                          <option key={embassy} value={embassy}>
                            {embassy}
                          </option>
                        ));
                    })()}
                  </select>
                </div>
                
                {/* RFE Toggle */}
                <div className="flex items-center justify-between p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-color)]">
                  <label className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer">
                    RFE received?
                  </label>
                  <input
                    type="checkbox"
                    checked={hasRFE}
                    onChange={(e) => {
                      onHasRFEChange(e.target.checked);
                      if (!e.target.checked) {
                        onRfeNoticeDateChange("");
                        onRfeResponseDateChange("");
                      }
                    }}
                    className="w-5 h-5 rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)] cursor-pointer"
                  />
                </div>
                
                {/* RFE Date Fields (shown only if RFE toggle is ON) */}
                {hasRFE && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
                        RFE Date {hasRFE && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="date"
                        value={rfeNoticeDate}
                        onChange={(e) => onRfeNoticeDateChange(e.target.value)}
                        className="w-full max-w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all text-base"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                        required={hasRFE}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
                        RFE Response Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={rfeResponseDate}
                        onChange={(e) => onRfeResponseDateChange(e.target.value)}
                        className="w-full max-w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all text-base"
                        style={{ WebkitAppearance: 'none', appearance: 'none' }}
                      />
                    </div>
                  </>
                )}
              </>
            )}
            
            {formType === "I-485" && (
              <>
                {/* I-485 Filing Category */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2.5">
                    I-485 Filing Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={i485Category}
                    onChange={(e) => onI485CategoryChange(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent transition-all"
                    required
                  >
                    <option value="">Select category</option>
                    {i485Categories.map((cat: { value: string; display: string }) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.display}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Also tracking I-765 */}
                <div className="flex items-center justify-between p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-color)]">
                  <label className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer">
                    Also tracking I-765
                  </label>
                  <input
                    type="checkbox"
                    checked={alsoTrackingI765}
                    onChange={(e) => onAlsoTrackingI765Change(e.target.checked)}
                    className="w-5 h-5 rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)] cursor-pointer"
                  />
                </div>
                
                {/* Also tracking I-131 */}
                <div className="flex items-center justify-between p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-color)]">
                  <label className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer">
                    Also tracking I-131
                  </label>
                  <input
                    type="checkbox"
                    checked={alsoTrackingI131}
                    onChange={(e) => onAlsoTrackingI131Change(e.target.checked)}
                    className="w-5 h-5 rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)] cursor-pointer"
                  />
                </div>
              </>
            )}
            
            {formType === "I-765" && (
              <>
                {/* Linked to I-485 */}
                <div className="flex items-center justify-between p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-color)]">
                  <div>
                    <label className="text-sm font-semibold text-[var(--text-primary)] cursor-pointer block">
                      Linked to I-485?
                    </label>
                    {linkedToI485 && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1">(c)(9) Pending I-485</p>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={linkedToI485}
                    onChange={(e) => {
                      onLinkedToI485Change(e.target.checked);
                    }}
                    className="w-5 h-5 rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)] cursor-pointer"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Terms and Privacy Acceptance */}
      <div className="bg-[var(--bg-surface-alt)] rounded-xl p-5 border border-[var(--border-color)]">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => onAcceptedTermsChange(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)] focus:ring-offset-0 cursor-pointer"
            required
          />
          <span className="text-sm text-[var(--text-secondary)] leading-relaxed">
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-[var(--text-primary)] hover:underline font-semibold">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-[var(--text-primary)] hover:underline font-semibold">
              Privacy Policy
            </Link>
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            console.log("[FormSubmit] Button clicked, formType:", formType);
            console.log("[FormSubmit] priorityDate:", priorityDate);
            console.log("[FormSubmit] acceptedTerms:", acceptedTerms);
            if (formType === "I-130") console.log("[FormSubmit] country:", country);
            if (formType === "I-129F") console.log("[FormSubmit] usEmbassy:", usEmbassy);
            if (formType === "I-485") console.log("[FormSubmit] i485Category:", i485Category);
            onSubmit();
          }}
          disabled={loading || !isFormValid() || !formType}
          className="w-full px-4 sm:px-6 py-3.5 min-h-[44px] bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none touch-manipulation active:scale-95 text-sm sm:text-base"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </span>
          ) : (
            "Save & Continue"
          )}
        </button>
      </div>
    </div>
  );
}

export default function ProfileSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--uscis-blue)]"></div>
      </div>
    }>
      <ProfileSetupContent />
    </Suspense>
  );
}
