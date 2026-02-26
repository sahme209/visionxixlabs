/**
 * USCIS Case Status Service
 * Matches iOS USCISCaseStatusService pattern
 * Calls Cloudflare Worker proxy: https://uscis-status-api-back.vision19.workers.dev
 */

const BASE_URL = "https://uscis-status-api-back.vision19.workers.dev";
const REQUEST_TIMEOUT = 30000; // 30 seconds
const READ_TIMEOUT = 60000; // 60 seconds

export interface USCISCaseStatusResponse {
  statusText: string;
  statusDetail?: string;
  lastUpdated?: string;
  caseNumber?: string;
  raw?: any;
}

export interface CaseStatusError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(`${BASE_URL}/`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "demo_id": "3344", // Match iOS demo_id header
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.ok === true;
  } catch (error) {
    console.error("Health check failed:", error);
    return false;
  }
}

/**
 * Extract error message from response data (matches iOS extractError)
 */
function extractError(data: any): { message: string | null; code: string | null } {
  if (!data || typeof data !== "object") {
    return { message: null, code: null };
  }
  const message = data.error || data.message || data.detail || null;
  const code = data.code || null;
  return { message, code };
}

/**
 * Maps raw USCIS error messages to user-friendly titles and messages
 * Matches iOS mapUSCISErrorToFriendly pattern
 */
export function mapUSCISErrorToFriendly(raw: string): { title: string; message: string } {
  const lowercased = raw.toLowerCase();
  
  // Check for 404 / case not found
  if (lowercased.includes("not found") || lowercased.includes("case not found")) {
    return {
      title: "Case not found",
      message: "This receipt number wasn't found in the USCIS system. Please verify the number is correct. For testing, you can use staging receipt numbers like EAC9999103403.",
    };
  }
  
  // Check for receipt number format errors
  if (
    lowercased.includes("receipt number") &&
    (lowercased.includes("not formatted") ||
      lowercased.includes("13 characters") ||
      lowercased.includes("3 character prefix") ||
      lowercased.includes("10 digits") ||
      lowercased.includes("format"))
  ) {
    return {
      title: "Receipt number looks wrong",
      message: "Your USCIS receipt number should be 13 characters — 3 letters followed by 10 numbers (example: IOE0912345678). Please double-check and try again.",
    };
  }
  
  // Check for temporarily unavailable
  if (
    lowercased.includes("temporarily unavailable") ||
    lowercased.includes("unavailable") ||
    lowercased.includes("service unavailable") ||
    lowercased.includes("timeout")
  ) {
    return {
      title: "USCIS is temporarily unavailable",
      message: "The USCIS Case Status API is currently unavailable. This usually happens outside of normal operation hours (M-F 7:00 AM - 8:00 PM EST). Please try again during those hours.",
    };
  }
  
  // Generic fallback for all other errors
  return {
    title: "Couldn't fetch your case yet",
    message: "USCIS is temporarily unavailable or your case couldn't be loaded. Please try again in a bit.",
  };
}

/**
 * Maps USCIS statusText to currentStage for JourneyPipeline and Timeline.
 * Used to drive "Your Case Timeline" from live USCIS data.
 */
export function mapUSCISStatusToCurrentStage(statusText: string): string | null {
  if (!statusText || typeof statusText !== "string") return null;
  const lower = statusText.trim().toLowerCase();

  // Approval / post-approval (completes USCIS step) — catch variants from USCIS API
  if (
    lower.includes("case was approved") ||
    lower.includes("we approved") ||
    lower.includes("approved your") ||
    lower.includes("petition was approved") ||
    lower.includes("form was approved") ||
    (lower.includes("approved") && !lower.includes("not approved") && !lower.includes("denied"))
  ) return "approved";

  // Interview-related
  if (lower.includes("interview was scheduled")) return "interview";
  if (lower.includes("interview was completed") || lower.includes("interview must be reviewed")) return "interview";

  // Card / visa issued (final stage)
  if (
    lower.includes("card was delivered") ||
    lower.includes("card is being produced") ||
    lower.includes("card was picked up") ||
    lower.includes("card mailed") ||
    lower.includes("green card") ||
    lower.includes("visa issued")
  ) return "visaIssued";

  // NVC/DQ - USCIS doesn't return these; they come from CEAC. Skip mapping for now.
  // if (lower.includes("nvc") || lower.includes("documentarily qualified")) return "dq";

  // USCIS processing (receipt, review, RFE, response, transfer)
  if (
    lower.includes("case was received") ||
    lower.includes("receipt notice") ||
    lower.includes("fingerprint fee") ||
    lower.includes("actively reviewed") ||
    lower.includes("request for") ||
    lower.includes("response to") ||
    lower.includes("evidence") ||
    lower.includes("case was transferred") ||
    lower.includes("decision notice mailed") ||
    lower.includes("case was denied")
  ) {
    return "uscis";
  }

  return null;
}

/**
 * Fetch case status from USCIS via Worker proxy
 * Matches iOS fetchCaseStatus pattern
 */
export async function fetchCaseStatus(
  receiptNumber: string
): Promise<USCISCaseStatusResponse> {
  // Validate & normalize receipt number (matches iOS)
  const trimmed = receiptNumber.trim();
  if (!trimmed || trimmed.length === 0) {
    throw {
      message: "Receipt number is required",
      code: "INVALID_RECEIPT",
      status: 400,
    } as CaseStatusError;
  }
  
  const normalizedReceipt = trimmed.toUpperCase();
  
  // Build URL using URL encoding (matches iOS)
  const encoded = encodeURIComponent(normalizedReceipt);
  const url = `${BASE_URL}/case-status/${encoded}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), READ_TIMEOUT);
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        demo_id: "3344", // Match iOS demo_id header
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const data = await response.json().catch(() => ({}));
    
    // Non-2xx handling (matches iOS)
    if (!response.ok) {
      // Special handling for 404 (case not found)
      if (response.status === 404) {
        const { message: rawMessage } = extractError(data);
        const rawErrorText = rawMessage || "";
        
        // Check if it's a "not found" error from our worker
        if (rawErrorText.toLowerCase().includes("not found") || rawErrorText === "") {
          throw {
            message: "Case not found. Please verify your receipt number is correct. For testing, use staging receipt numbers like EAC9999103403.",
            code: "CASE_NOT_FOUND",
            status: 404,
          } as CaseStatusError;
        } else {
          throw {
            message: rawErrorText,
            code: "CASE_NOT_FOUND",
            status: 404,
          } as CaseStatusError;
        }
      }
      
      // Extract error and map to friendly message
      const { message: rawMessage } = extractError(data);
      const rawErrorText = rawMessage || `Request failed with status ${response.status}`;
      
      // Use friendly error mapping
      const friendly = mapUSCISErrorToFriendly(rawErrorText);
      
      // Log raw error for debugging (but don't expose to user)
      console.error("USCIS Status Error Response:", {
        status: response.status,
        raw: rawErrorText,
        friendly: friendly.message,
      });
      
      // Throw friendly message only (no raw JSON/technical details)
      throw {
        message: friendly.message,
        code: "CASE_FETCH_FAILED",
        status: response.status,
      } as CaseStatusError;
    }
    
    // Decode response (matches iOS USCISCaseStatusResponse structure)
    // The API returns normalized response with status_text, status_code, last_updated
    // But we also handle the case_status nested structure for backward compatibility
    const caseStatus = data?.case_status ?? {};
    const statusText = data?.status_text ?? caseStatus.status ?? caseStatus.title ?? "Status unavailable";
    const statusDetail = data?.status_detail ?? caseStatus.detail ?? caseStatus.description ?? "";
    const lastUpdated = data?.last_updated ?? caseStatus.last_updated ?? data?.lastUpdated;
    
    return {
      statusText,
      statusDetail,
      lastUpdated,
      caseNumber: normalizedReceipt,
      raw: data,
    };
  } catch (error: any) {
    // Handle abort/timeout
    if (error.name === "AbortError") {
      throw {
        message: "Request timeout. Please try again.",
        code: "TIMEOUT",
        status: 408,
      } as CaseStatusError;
    }
    
    // Re-throw if it's already a CaseStatusError
    if (error.code && error.status) {
      throw error;
    }
    
    // Network errors
    throw {
      message: error.message || "Failed to fetch case status",
      code: "NETWORK_ERROR",
      status: 500,
    } as CaseStatusError;
  }
}
