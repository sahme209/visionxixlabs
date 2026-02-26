## Async Engine Pattern

This document describes the common asynchronous engine pattern used by the following flows:

- `app/api/cloud-studio/trigger` and `app/api/cloud-studio/status`
- `app/api/cloud-operator/trigger` and `app/api/cloud-operator/status`
- `app/api/leads/trigger` and `app/api/leads/status`

All behavior here is **descriptive only**. It documents existing patterns for:

- Token verification
- `outputStatus` lifecycle
- Status transitions
- Lead update pattern

No runtime logic is changed by this document.

---

### 1. High-level lifecycle

At a high level, all three engines follow the same lifecycle for a user’s request:

1. **Intake / Submit (not covered here):**
   - A `lead` row is created in the database.
   - Initial payload (form inputs, profiles, tier info, etc.) is stored in `lead.fullPayload`.
   - `fullPayload.outputStatus` is initialized to `"pending"` (or omitted, in which case it defaults to pending in status routes).
   - A short-lived **starter token** is issued and given back to the client.

2. **Trigger (asynchronous generation):**
   - Client calls `/api/.../trigger` with the token.
   - The route:
     - Verifies the token.
     - Loads the `lead` and its `fullPayload`.
     - If already complete, may early-return.
     - Invokes the relevant AI/scoring engines.
     - Writes results back to `lead.fullPayload` and updates `outputStatus` to `"ready"` (or an equivalent terminal state).

3. **Status (polling and gated retrieval):**
   - Client calls `/api/.../status` with the token.
   - The route:
     - Verifies the token.
     - Fetches the `lead` and `fullPayload`.
     - Reads `outputStatus`.
     - Returns a JSON payload describing:
       - Request/lead metadata.
       - Current `outputStatus` (`"pending"`, `"processing"`, `"ready"`, or `"error"` as implemented).
       - Tier-gated outputs (summaries vs. full technical artifacts).

This pattern provides a consistent async contract across Cloud Studio, Cloud Operator, and lead-level triggers.

---

### 2. Token verification

All three async flows rely on a **starter token** that encodes the `leadId` and expiry. The pattern is:

1. **Retrieve token from request:**
   - For `status` routes:
     - `GET /api/.../status?token=XXX`
     - Token is read from `req.nextUrl.searchParams.get("token")`.
   - For `trigger` routes:
     - `POST /api/.../trigger`
     - Token is read from the JSON body (`body.token`) or query string, depending on the route.

2. **Verify token:**

   - All routes call a shared helper:

     ```ts
     const result = verifyStarterToken(token);
     ```

   - If verification fails:
     - If expired, respond with `401` and an `"Token expired"` (or equivalent) message.
     - If invalid, respond with `401` and `"Invalid token"`.

3. **Extract lead id:**

   - When verification succeeds, `result.leadId` is used to look up the `lead`:

     ```ts
     const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
     ```

4. **Source validation (flow binding):**

   - Each async engine confirms the `lead.source` matches its flow:
     - Cloud Studio: `lead.source === "cloud-studio"` (or equivalent value).
     - Cloud Operator: `lead.source === "cloud-operator"`.
     - Leads trigger: `lead.source` is checked against the expected value for that trigger.
   - If the source does not match, a `404` (`{ error: "Not found" }`) is returned, preventing cross-flow token reuse.

Token verification therefore provides **both** authentication (time-limited token) and scoping (binding a token to a single lead + flow).

---

### 3. `outputStatus` lifecycle

Each `lead` stores an `outputStatus` field inside `fullPayload` to represent the async job’s lifecycle.

#### 3.1 Possible values

While individual routes may use slightly different strings, the common pattern includes:

- `"pending"` – request accepted but async engine has not been run yet.
- `"processing"` – (optional) async work is in progress but not yet completed.
- `"ready"` – async work completed successfully and outputs are available.
- `"error"` – async work failed; error details may be logged server-side or stored in payload.

#### 3.2 Initialization

- On submit/intake:
  - `fullPayload.outputStatus` is typically set to `"pending"` when the lead is created.
  - Some flows may omit this field, and the status route treats missing as `"pending"`.

#### 3.3 Status route interpretation

- Status routes read:

  ```ts
  const outputStatus = (payload.outputStatus as string) || "pending";
  ```

- They then:
  - Surface `outputStatus` in the JSON response for the client.
  - Use it to determine whether to include full outputs or just minimal metadata:
    - If `"pending"` / `"processing"`:
      - Only lead/tier info and basic progress signals are returned.
    - If `"ready"`:
      - Full outputs are available (subject to tier gating).
    - If `"error"`:
      - An error state is returned; clients can show failure UI or retry guidance.

#### 3.4 Trigger route transitions

- Trigger routes are responsible for moving the status forward:

  1. **Starting work:**
     - Optionally set `outputStatus` to `"processing"` when generation starts.
  2. **Success:**
     - After AI/scoring completes and outputs are stored:

       ```ts
       fullPayload: {
         ...payload,
         /* ...domain-specific fields... */
         outputStatus: "ready",
       }
       ```

  3. **Failure:**
     - If an exception is caught, routes may:
       - Set `outputStatus` to `"error"`.
       - Return a `500` JSON response.

This pattern ensures that the status endpoint can always represent the async engine’s current state without recomputing work.

---

### 4. Status transitions and tier gating

In addition to `outputStatus`, the async engines share a common pattern of **tier-aware** status responses.

#### 4.1 Tier resolution

- Each flow derives a normalized tier from the payload (or user account):

  ```ts
  const tier = resolveTier(payload.tier as string | undefined);
  ```

- For Cloud Operator specifically:
  - Uses `resolveOperatorTier` to map raw strings into:
    - `"free"`, `"pro"`, `"growth"`, `"enterprise"`.

#### 4.2 Capability helpers

- Tier helpers encapsulate gating logic, e.g.:

  ```ts
  canViewTechnicalOutputs(tier);
  canDownloadConfigs(tier);
  hasContinuousReassessment(tier);
  hasEnterpriseEngagement(tier);
  ```

- These helpers do **not** affect `outputStatus`, but they determine **how much** of the async result is exposed when `outputStatus` is `"ready"`.

#### 4.3 Status response shape

- All `status` routes return a JSON object that includes:
  - `leadId` and `status` (lead-level).
  - `outputStatus` (async state).
  - Tier and capability flags (e.g. `tier`, `canViewTechnicalOutputs`, etc.).
  - A set of metrics and summaries that are always safe to return (e.g. scores, executive summaries).
  - Optionally, when `outputStatus === "ready"` and tier allows:
    - Full technical artifacts (YAML, configs, CI/CD files).
    - Detailed plans/roadmaps.
    - Detection signals / advisory flags.

Clients therefore:

- Poll `status` until `outputStatus` is `"ready"` or `"error"`.
- Use the tier capability flags to decide which UI sections to show or hide.

---

### 5. Lead update pattern

All async engines rely on a shared lead update pattern using Prisma and the `fullPayload` JSONB field.

#### 5.1 Read-modify-write cycle

1. **Load lead:**

   ```ts
   const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
   const payload = (lead.fullPayload as Record<string, unknown>) || {};
   ```

2. **Compute outputs:**

   - Trigger route executes domain-specific logic:
     - Cloud Studio:
       - Calls scoring and AI generation for architecture reviews / recommendations.
     - Cloud Operator:
       - Calls `generateOperatorEngineOutput` and Axiom’s `generateInfrastructureAdvantageModel`.
     - Leads trigger:
       - Kicks off the corresponding async engine for that lead context.

3. **Construct updated payload:**

   - The existing payload is preserved and extended:

     ```ts
     const updatedPayload = {
       ...payload,
       // existing fields (profiles, previous outputs, history, tier, etc.)
       ...domainSpecificFields, // e.g. operatorOutput, scores, axiomResult, history, etc.
       outputStatus: "ready",
     } as object;
     ```

   - Key characteristics:
     - **Non-destructive**: previous fields remain unless intentionally overwritten.
     - **Version-friendly**: new engines (like Axiom) add fields alongside legacy ones.
     - **Backwards-compatible**: legacy consumers can still read older fields (e.g. `operatorOutput`, `axiomPlan`).

4. **Persist via Prisma:**

   ```ts
   await prisma.lead.update({
     where: { id: lead.id },
     data: {
       status: "package_ready" /* or flow-specific terminal status */,
       fullPayload: updatedPayload,
     },
   });
   ```

5. **Return trigger response:**

   - Trigger routes typically return a small JSON object indicating success:

   ```ts
   return NextResponse.json({
     success: true,
     status: "ready",
     /* optionally: key outputs and/or scores for immediate use */
   });
   ```

#### 5.2 History and trend tracking (where implemented)

- For flows that track history (e.g. Axiom in Cloud Operator):
  - The trigger route can append to a history array (e.g. `axiomHistory`) in `fullPayload`.
  - The status route then:
    - Reads the latest historical entry.
    - Computes deltas (e.g. `scoreDelta`, `savingsDelta`, `riskDelta`).
    - Exposes a `trend` object in the response.

This history-based pattern builds on the same lead update model, further reinforcing the read-modify-write contract on `fullPayload`.

---

### 6. Summary

The async engine pattern across Cloud Studio, Cloud Operator, and lead-level triggers is built on a **shared contract**:

- **Token verification** to bind client polling to a specific lead and flow.
- A simple **`outputStatus` lifecycle** (`pending` → `processing` → `ready` / `error`) stored in `lead.fullPayload`.
- **Status transitions** driven by trigger routes and surfaced via status routes.
- A **lead-centric update pattern** using a JSONB `fullPayload` to store both inputs and outputs, enabling non-destructive evolution of features like Axiom.

This consistency enables UI and automation layers to integrate new async flows with predictable behavior while keeping existing routes and data structures intact.

