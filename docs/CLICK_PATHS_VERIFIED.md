# Click Paths Verified

**What changed:** All primary flows verified end-to-end. No dead ends. Fallbacks added when env vars (e.g. VERCEL_TOKEN) are missing.

---

## 1. Home → Axiom → Analysis Result

1. **Home** (/)
2. Click **Run Axiom Analysis**
3. Land on **/cloud-operator**
4. Fill form (project type, hosting, spend, etc.)
5. Submit → POST /api/cloud-operator/submit
6. Redirect to **/cloud-operator?token=XXX**
7. Trigger fires (POST /api/cloud-operator/trigger)
8. Status polls (GET /api/cloud-operator/status)
9. UI shows analysis result when outputStatus === "ready"

**Status:** ✓ Verified

---

## 2. Home → Website Builder → Thank-You → Preview Ready

1. **Home** (/)
2. Navigate to **/request** (via Solutions → Website Request / Get a Quote)
3. Fill form and click **Get my AI-built site preview**
4. Submit → POST /api/leads
5. Redirect to **/request/thank-you?token=XXX**
6. Trigger fires (POST /api/leads/trigger)
7. Status polls (GET /api/leads/status)
8. If VERCEL_TOKEN set: deploy_ready, previewUrl shown
9. If VERCEL_TOKEN missing: package_ready, deployStatus managed_pending, UI shows "Preview pending—our team will deploy"

**Status:** ✓ Verified (with fallback)

---

## 3. Home → Cloud Studio → Result Ready

1. **Home** (/)
2. Navigate to **/cloud-studio** (via Solutions or direct URL)
3. Select service type, fill form
4. Submit → POST /api/cloud-studio/submit
5. Redirect to **/cloud-studio/result?token=XXX**
6. Trigger fires (POST /api/cloud-studio/trigger)
7. Status polls (GET /api/cloud-studio/status)
8. UI shows summary (and full output if tier allows) when outputStatus === "ready"

**Status:** ✓ Verified

---

## Secondary Paths

- **Contact:** /contact → form → POST /api/contact
- **Free Review:** /free-review → human-led flow
- **Vision XIX AI:** /visionxix-ai, /visionxix-ai-assistant, /visionxix-ai/pricing
- **Products:** /apps → VisaNova, RecallEase
