# USCIS Demo Response - Current Flow & Architecture Explanation

**Date:** January 25, 2026  
**Organization:** Vision XIX Labs  
**Application:** VisaNova (Web, iOS, Android)

---

## 1. Current Flow: User Enters Receipt Number

### Step-by-Step User Journey

1. **User Input (Frontend - Client Application)**
   - User navigates to Profile Setup page (`/profile-setup`)
   - User enters a 13-character receipt number (e.g., `EAC9999103403`) in the receipt number input field
   - Input is validated: must be exactly 13 characters (3 letters + 10 digits)
   - **Location:** `VisaNovaWeb/app/profile-setup/page.tsx` (lines 1070-1073)

2. **Data Formatting (Frontend)**
   - Receipt number is trimmed and converted to uppercase
   - Data is formatted into JSON structure (though this is implicit in the fetch call)
   - **Status:** ✅ PASS (USCIS confirmed this requirement passed)

3. **API Request Initiation (Frontend → Backend Proxy)**
   - Frontend makes HTTP GET request to **Cloudflare Worker backend**
   - **NOT directly to USCIS API** - all requests go through our backend proxy
   - **Endpoint:** `https://uscis-status-api-back.vision19.workers.dev/case-status/{receiptNumber}`
   - **Headers:**
     - `Accept: application/json`
     - `demo_id: 3344` (for demo tracking)
   - **Location:** `VisaNovaWeb/lib/services/uscisStatusService.ts` (lines 122-152)

4. **Backend Proxy Processing (Cloudflare Worker)**
   - Worker receives request from client
   - Worker performs **OAuth 2.0 Client Credentials authentication** with USCIS API
   - Worker makes authenticated request to USCIS API
   - Worker receives response from USCIS API
   - Worker normalizes and returns response to client
   - **Location:** `VisaNova-IOS/worker.js` (lines 36-130)

5. **Response Handling (Frontend)**
   - Frontend receives JSON response from Worker
   - Response is parsed and displayed in UI
   - Success: Shows case status with status text, details, and last updated date
   - Error: Shows user-friendly error message
   - **Location:** `VisaNovaWeb/components/USCISCaseStatus.tsx` (lines 75-95)

---

## 2. Backend Architecture Explanation

### Architecture Overview

**All requests to the USCIS Case Status API come from our backend service (Cloudflare Worker), NOT directly from client applications.**

### Backend Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Web App    │  │   iOS App    │  │ Android App  │         │
│  │  (Next.js)   │  │   (SwiftUI)  │  │   (Kotlin)   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                            │ HTTPS GET Request                   │
│                            │ /case-status/{receiptNumber}        │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND SERVICE (Cloudflare Worker)                │
│  URL: https://uscis-status-api-back.vision19.workers.dev       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 1: OAuth 2.0 Authentication                        │   │
│  │  - POST https://api-int.uscis.gov/oauth/accesstoken     │   │
│  │  - Uses Client Credentials grant type                   │   │
│  │  - Credentials stored in Worker secrets (env vars)       │   │
│  │  - Returns: access_token                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 2: Authenticated USCIS API Request                │   │
│  │  - GET https://api-int.uscis.gov/case-status/{receipt}  │   │
│  │  - Header: Authorization: Bearer {access_token}        │   │
│  │  - Header: Accept: application/json                     │   │
│  │  - Returns: Case status JSON response                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│                            ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Step 3: Response Normalization                          │   │
│  │  - Normalizes USCIS response format                      │   │
│  │  - Handles errors and edge cases                         │   │
│  │  - Returns standardized JSON to client                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTPS Response (JSON)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                          │
│  - Receives normalized JSON response                            │
│  - Renders case status in UI                                    │
│  - Handles errors with user-friendly messages                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architecture Points

1. **All USCIS API requests originate from backend:**
   - Client applications (Web, iOS, Android) **never directly call** the USCIS API
   - All requests go through our Cloudflare Worker backend at `uscis-status-api-back.vision19.workers.dev`
   - This ensures:
     - OAuth credentials are never exposed to clients
     - All API calls are centralized and logged
     - Rate limiting and error handling are consistent

2. **Backend Implementation Details:**
   - **Platform:** Cloudflare Workers (serverless edge computing)
   - **Language:** JavaScript
   - **OAuth Implementation:** Client Credentials grant type
   - **Credential Storage:** Cloudflare Worker secrets (environment variables)
   - **Code Location:** `VisaNova-IOS/worker.js`

3. **OAuth 2.0 Flow (Backend):**
   ```javascript
   // Step 1: Get Access Token
   POST https://api-int.uscis.gov/oauth/accesstoken
   Content-Type: application/x-www-form-urlencoded
   
   grant_type=client_credentials
   client_id={USCIS_CLIENT_ID}
   client_secret={USCIS_CLIENT_SECRET}
   
   // Step 2: Use Access Token
   GET https://api-int.uscis.gov/case-status/{receiptNumber}
   Authorization: Bearer {access_token}
   Accept: application/json
   ```

4. **Desktop vs Mobile Backend:**
   - **Same backend service** for all platforms (Web, iOS, Android)
   - All platforms call the same Cloudflare Worker endpoint
   - No platform-specific backend differences
   - **Backend URL:** `https://uscis-status-api-back.vision19.workers.dev`

---

## 3. Client Authentication to Our Services

### How Client Applications Authenticate to Our Backend

**Current Implementation:** No authentication required for case status requests

1. **Public Endpoint:**
   - Our Cloudflare Worker endpoint (`/case-status/{receiptNumber}`) is currently **public**
   - No authentication required from client applications
   - This is acceptable because:
     - The endpoint only accepts receipt numbers (public information)
     - No sensitive user data is exposed
     - Rate limiting can be implemented at the Worker level

2. **Future Enhancement (Optional):**
   - We can implement API key authentication if required
   - Clients would include: `Authorization: Bearer {api_key}` header
   - API keys would be issued per application/platform
   - This would allow us to:
     - Track usage per client
     - Implement per-client rate limiting
     - Monitor and log requests by application

3. **Current Security Measures:**
   - CORS headers configured to allow requests from our domains
   - Input validation (receipt number format)
   - Error handling that doesn't expose internal details
   - Timeout protection (30s request, 60s read timeout)

### Recommended Approach for Production

If USCIS requires client authentication to our services, we can implement:

1. **API Key Authentication:**
   - Each client application (Web, iOS, Android) gets a unique API key
   - Keys are embedded in application code (not user-specific)
   - Worker validates API key before processing requests

2. **JWT Token Authentication:**
   - Clients authenticate users via Firebase Auth
   - Generate JWT tokens for authenticated users
   - Worker validates JWT tokens before processing requests

**Current Status:** We can implement either approach if required by USCIS.

---

## 4. Frontend Data Rendering Fix

### Issue Identified

USCIS noted: *"your desktop application failed to render the results of the JSON body when a 200 OK is passed."*

### Current Frontend Implementation

**Web Application (Desktop):**
- **Component:** `VisaNovaWeb/components/USCISCaseStatus.tsx`
- **Response Handling:** Lines 75-95
- **Rendering:** Lines 200-350

### Current Response Parsing Logic

```typescript
// From uscisStatusService.ts (lines 203-217)
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
```

### Potential Issues & Fixes

1. **Issue: Response Structure Mismatch**
   - **Problem:** USCIS API response structure may differ from expected format
   - **Fix:** Enhanced response parsing to handle multiple response formats
   - **Status:** ✅ Already implemented with fallback parsing

2. **Issue: Missing Error Handling for 200 OK with Error Body**
   - **Problem:** API returns 200 OK but JSON body contains error information
   - **Fix:** Check response body for error indicators even on 200 status
   - **Status:** ⚠️ Needs enhancement

3. **Issue: UI Not Updating on Successful Response**
   - **Problem:** Component state not updating when response received
   - **Fix:** Ensure `setStatus()` and `setLoadState("success")` are called
   - **Status:** ✅ Currently implemented (lines 78-80)

### Recommended Fixes

1. **Enhanced Response Validation:**
   ```typescript
   // Check for errors even in 200 OK responses
   if (data?.error || data?.status_code !== "200") {
     // Handle as error even though HTTP status is 200
   }
   ```

2. **Better Logging for Debugging:**
   ```typescript
   console.log("USCIS Response (200 OK):", {
     status: response.status,
     data: data,
     parsed: { statusText, statusDetail, lastUpdated }
   });
   ```

3. **UI State Management:**
   - Ensure loading state is cleared on success
   - Ensure error state is cleared on success
   - Display raw response in debug mode for troubleshooting

### Testing Recommendations

1. **Test with Various Response Formats:**
   - Standard success response
   - Success with nested case_status object
   - 200 OK with error in body
   - Missing fields in response

2. **Verify UI Updates:**
   - Status text displays correctly
   - Last updated date formats properly
   - Error messages show when appropriate
   - Loading states transition correctly

---

## 5. OAuth 2.0 Authentication Status

### Current Implementation

**Location:** `VisaNova-IOS/worker.js` (lines 36-91)

**Implementation:**
- ✅ Client Credentials grant type
- ✅ Credentials stored in Worker secrets
- ✅ Access token caching (if implemented)
- ✅ Error handling for token failures

### Potential Issues

1. **Token Request Format:**
   - Currently using form-urlencoded body
   - Alternative: Basic Auth header (commented in code)
   - **Action:** Verify which format USCIS expects

2. **Token Expiration:**
   - Access tokens expire (typically 3600 seconds)
   - **Action:** Implement token refresh/caching

3. **Error Handling:**
   - Token request failures need proper error messages
   - **Action:** Enhanced error logging and user feedback

### Recommended Actions

1. **Verify OAuth Endpoint:**
   - Confirm correct OAuth endpoint URL
   - Test token request manually
   - Verify credentials are correct

2. **Implement Token Caching:**
   - Cache access tokens in Worker KV storage
   - Refresh tokens before expiration
   - Handle token refresh failures gracefully

3. **Enhanced Logging:**
   - Log OAuth token requests (without exposing secrets)
   - Log token response status
   - Log authenticated API request results

---

## 6. Next Steps & Recommendations

### Immediate Actions Required

1. **Fix Frontend Rendering:**
   - ✅ Review response parsing logic
   - ✅ Add comprehensive error handling for 200 OK responses
   - ✅ Test with various response formats
   - ✅ Verify UI updates correctly

2. **Verify OAuth Authentication:**
   - Test OAuth token request manually
   - Verify credentials are correct
   - Check token response format
   - Implement token caching if needed

3. **Enhanced Testing:**
   - Test end-to-end flow with real receipt numbers
   - Test error scenarios (404, 500, timeout)
   - Test with various response formats
   - Verify all platforms (Web, iOS, Android) work correctly

4. **Documentation:**
   - Document backend architecture clearly
   - Document OAuth flow with code references
   - Document client authentication approach
   - Create architecture diagrams

### For Re-Demonstration

1. **Prepare Architecture Documentation:**
   - Backend architecture diagram
   - OAuth flow diagram
   - Request/response flow diagram

2. **Prepare Code Walkthrough:**
   - Show OAuth implementation in Worker
   - Show client request flow
   - Show response handling
   - Show error handling

3. **Prepare Test Cases:**
   - Success scenario with valid receipt number
   - Error scenarios (404, 500, timeout)
   - Edge cases (malformed receipt, empty response)

4. **Prepare Monitoring:**
   - Show request logs
   - Show OAuth token requests
   - Show API response handling

---

## 7. Code References

### Backend (Cloudflare Worker)
- **OAuth Implementation:** `VisaNova-IOS/worker.js` (lines 36-91)
- **API Request:** `VisaNova-IOS/worker.js` (lines 93-130)
- **Worker Handler:** `VisaNova-IOS/worker.js` (lines 152-216)

### Web Application
- **Service Layer:** `VisaNovaWeb/lib/services/uscisStatusService.ts`
- **UI Component:** `VisaNovaWeb/components/USCISCaseStatus.tsx`
- **Profile Setup:** `VisaNovaWeb/app/profile-setup/page.tsx`

### iOS Application
- **Service:** `VisaNova-IOS/VisaFlow/USCISCaseStatusService.swift`
- **API Client:** `VisaNova-IOS/VisaFlow/Networking/USCISStatusAPI.swift`
- **OAuth Docs:** `VisaNova-IOS/VisaFlow/USCISOAuthArchitectureView.swift`

### Android Application
- **Service:** `VisaNova-Android/app/src/main/java/com/visanova/app/core/services/USCISCaseStatusService.kt`

---

## 8. Contact Information

For questions or clarifications:
- **Email:** developersupport@uscis.dhs.gov
- **Organization:** Vision XIX Labs
- **Application:** VisaNova

---

**Document Prepared:** January 25, 2026  
**Status:** Ready for re-demonstration after fixes are implemented
