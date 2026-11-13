# LinkedIn image protocol — three approved public reads consumed

Authority: owner explicitly approved up to three official LinkedIn/Microsoft documentation pages. Exactly three distinct pages were read; search located the official pages. No authenticated/API request, credential, upload, installation or spending occurred. These findings supersede pending-documentation statements only, not real profile qualification.

## 1. Images API
[Official Images API, July 2026 view](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-07), retrieved November12; displayed update June24.

Initialization uses POST `https://api.linkedin.com/rest/images?action=initializeUpload`, with owner in initializeUploadRequest and version/Rest.li headers. Successful initialization is200 and returns image URN, upload URL and uploadUrlExpiresAt. The example upload destination is www.linkedin.com under /dms-uploads/{imageId}/uploaded-image/0. Images API does not support synchronous upload. Its status distinguishes waiting, processing, failed processing and available. Exact-resource GET returns owner/id/status; versioned GET is unavailable with only w_member_social. This matters before choosing a usable profile: never add scopes automatically or assume write permission authorizes observation. Upload expiry is returned, not a fixed duration. The inspected page does not establish an exhaustive destination grammar or a universal PUT-processing guarantee. No account capability or supported-version qualification is established by reading it.

## 2. Upload section linked by Images API
[Official Vector Assets API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/vector-asset-api?view=li-lms-2026-07), specifically Upload the Image.

The Images API directs its upload step here. It specifies PUT of the image bytes to the returned address with OAuth Authorization. The example response is201 with zero content length. This is evidence for byte acceptance, not proof that the newer asynchronous Images API has completed processing. Do not import the older Assets API synchronous-upload setting into Images API or infer a retry right from other examples. No request was made to either API.

## 3. Migration guide
[Official Content API Migration](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/contentapi-migration-guide?view=li-lms-2026-07), Assets→Images section; displayed update February25.

Images replaces generic asset identifiers with image identifiers and removes upfront recipes and the legacy upload-header structure. The old asset initializer/recipe/profile must not be substituted for the reviewed image plan.

## Application decisions, not vendor promises

The prepared pure protocol module accepts only a deliberately narrow subset matching the published initializer example: exact HTTPS origin www.linkedin.com, image-bound uploaded-image pathname, four fixed example query fields and one bounded opaque ut value. This is an application refusal policy, NOT a guarantee about every legitimate vendor response. Alternate shapes refuse; no dynamic host widening, caller upload URL or legacy fallback. Canonical URL, headers, version selection and actual server behavior still require concrete fixed-profile independent review and real qualification before a default allow path.

Initializer metadata narrows returned expiry to the existing action deadline. PUT acceptance remains uploadAccepted=true/mediaReady=false. Only a separately authenticated exact owner/image AVAILABLE observation can support readiness; the pure body parser cannot issue that proof. Current local SQL acceptance uses explicitly synthesized native observations and is not upgraded by this module.

## Next required connected implementation

Implement the private bounded initializer/PUT and exact availability observation using these source facts; keep native/key/decoder/runtime/default qualification unavailable. Preserve durable claims before credentials, immutable encrypted complete address, both current humans/source/deadlines around awaits and unknown/no-replay outcomes. No posting follows initializer/201 alone. Establish observation permission before any initialization; missing permission refuses without minting or requesting grants. No automatic status polling, reinitialization, retries or renewal. Complete connected client/HTTP/HMAC/SQL positive and adversarial journeys, then the planned whole-three-family review/green PR. Real-world and master-plan gates remain open.
