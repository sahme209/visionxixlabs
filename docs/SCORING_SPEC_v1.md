## Axiom Scoring Specification v1

This document describes the current deterministic scoring logic used across:

- `computeCloudIntelligence` (Cloud Studio)
- `computeCloudOperatorScores` (Cloud Operator)
- Axiom’s `infrastructureScore` (Infrastructure Advantage Model™)
- Risk level and savings estimation rules

All logic described here is **already implemented** in the codebase and is **not** changed by this document.

---

### 1. `computeCloudIntelligence` (Cloud Studio)

**Location:** `lib/cloudStudio/scoring.ts`  
**Signature:**

```ts
computeCloudIntelligence(
  serviceType: string,
  form: Record<string, unknown>,
  _output?: Record<string, unknown> | null
): CloudIntelligence
```

#### 1.1 Inputs

- `serviceType` (string):
  - Expected values in practice:
    - `"cicd"`, `"cost"`, `"security"`, `"architecture"`, `"networking"`.
- `form` (object):
  - Shape depends on `serviceType`, but the scoring engine looks at:
    - `estimatedMonthlySpend` (cost)
    - `servicesUsed` (cost)
    - `region` (cost + networking)
    - `trafficEstimate` (architecture)
    - `dataStorageNeeds` (architecture)
    - `vpcRequirements` (networking)
    - `connectivity` (networking)
    - `publicServices` (security)
    - `complianceGoal` (security)

#### 1.2 Internal parsing helpers

- **Monthly spend parsing**

  - `parseMonthlySpend(value)`:
    - Strips `$` and `,`, trims, parses as float.
    - Returns `0` if empty/invalid or negative.

- **Traffic level parsing**

  - `parseTrafficLevel(value)`:
    - Converts to lowercase string.
    - Returns:
      - `"high"` if it matches patterns like `million`, `m`, `500k`, `100k`, `high`, `heavy`.
      - `"medium"` if it matches `10k`, `50k`, `100k`, `moderate`, `medium`.
      - `"low"` otherwise.

- **Service count estimation**

  - `countServices(value)`:
    - Splits on commas/semicolons, trims, counts non-empty parts.
    - If at least one part: returns count.
    - Else:
      - If string length > 30: returns `4`.
      - If string length > 10: returns `2`.
      - Else: returns `1`.

- **Multi-region detection**

  - `hasMultiRegion(value)`:
    - Looks for `multi`, separators (`,`, `;`), `and`, `multiple` in lowercase string.
    - Requires length > 3 to avoid noise.

- **Strict compliance detection**

  - `hasStrictCompliance(value)`:
    - Matches `soc2`, `hipaa`, `pci`, `gdpr`, `fedramp`, or the word `compliance` (case-insensitive, spacing tolerant).

- **Public exposure detection**

  - `hasPublicExposure(value)`:
    - Matches `api`, `web`, `public`, `internet`, `facing` in lowercase string.
    - Requires length > 2.

#### 1.3 Derived intermediate values

- `monthlySpend`:
  - If `serviceType === "cost"`:
    - `parseMonthlySpend(form.estimatedMonthlySpend)`.
  - Else: `0`.

- `trafficEstimate`:
  - If `serviceType === "architecture"`:
    - `parseTrafficLevel(form.trafficEstimate)`.
  - Else: `"low"`.

- `multiRegion`:
  - `hasMultiRegion(form.region)` OR
  - (`serviceType === "networking"` AND `hasMultiRegion(form.connectivity)`).

- `compliance`:
  - For `serviceType === "security"`:
    - `hasStrictCompliance(form.complianceGoal)`.
  - Else: `false`.

- `publicExposure`:
  - If `serviceType === "security"`:
    - `hasPublicExposure(form.publicServices)`.
  - Else if `serviceType === "architecture"`:
    - `hasPublicExposure(form.appType)` OR `hasPublicExposure(form.dataStorageNeeds)`.
  - Else: `false`.

- `serviceCount`:
  - If `serviceType === "cost"`:
    - `countServices(form.servicesUsed)`.
  - Else if `serviceType === "architecture" || "networking"`:
    - `countServices(form.dataStorageNeeds ?? form.vpcRequirements ?? "")`.
  - Else:
    - Constant `2`.

#### 1.4 Outputs (`CloudIntelligence`)

```ts
type CloudIntelligence = {
  cloudMaturityScore: number;
  optimizationOpportunity: "Low" | "Medium" | "High";
  riskLevel: "Low" | "Medium" | "High";
  estimatedAnnualSavings: number | null;
  complexityTier: "Self-Serve" | "Growth" | "Enterprise";
  generatedAt: string; // ISO timestamp
};
```

##### 1.4.1 Cloud Maturity Score (0–100)

- Base:
  - `maturity = 40`.
- Adjustments:
  - `+15` if `monthlySpend >= 2000`, else `+10` if `monthlySpend >= 500`.
  - `+10` if `multiRegion` is true.
  - `+10` if `compliance` is true.
  - `+5` if `trafficEstimate === "high"`.
  - `+5` if `serviceCount >= 5`.
  - `+10` if `serviceType === "security"` and `publicExposure` is true.
  - `+5` if `serviceType === "architecture"` and `serviceCount >= 3`.
- Final:
  - Clamped to `[0, 100]`.

##### 1.4.2 Optimization Opportunity

- Only for `serviceType === "cost"`:
  - `"High"` if `monthlySpend >= 2000`.
  - `"Medium"` if `monthlySpend >= 500`.
  - `"Low"` otherwise.
- For non-`"cost"` service types:
  - Remains `"Low"` by default.

##### 1.4.3 Risk Level

- Base: `"Low"`.
- If `serviceType === "security"` and `publicExposure`:
  - `"High"` if `compliance` is true.
  - `"Medium"` otherwise.
- Else if `serviceType === "architecture"` and `publicExposure`:
  - `"Medium"`.

##### 1.4.4 Estimated Annual Savings

- Only for `serviceType === "cost"` and `monthlySpend > 0`:
  - `annual = monthlySpend * 12`.
  - Multiplier `rate`:
    - `0.2` for `"High"` optimization opportunity.
    - `0.15` for `"Medium"`.
    - `0.1` for `"Low"`.
  - `estimatedAnnualSavings = round(annual * rate)`.
- Else:
  - `estimatedAnnualSavings = null`.

##### 1.4.5 Complexity Tier

- Base: `"Self-Serve"`.
- If:
  - `cloudMaturityScore >= 70` OR
  - `monthlySpend >= 2000` OR
  - (`multiRegion && compliance`):
  - Then `"Enterprise"`.
- Else if:
  - `cloudMaturityScore >= 45` OR
  - `monthlySpend >= 500` OR
  - `serviceCount >= 4`:
  - Then `"Growth"`.
- Else:
  - `"Self-Serve"`.

---

### 2. `computeCloudOperatorScores` (Cloud Operator)

**Location:** `lib/cloudStudio/scoring.ts`  
**Signature:**

```ts
export function computeCloudOperatorScores(
  profile: OperatorProfileInput
): CloudOperatorScores
```

#### 2.1 Inputs (`OperatorProfileInput`)

```ts
type OperatorProfileInput = {
  projectType?: string | null;
  hostingProvider?: string | null;
  monthlySpend?: string | number | null;
  trafficLevel?: string | null;
  hasCiCd?: string | boolean | null;
  publicExposure?: string | null;
  complianceNeeds?: string | null;
  gitProvider?: string | null;
  primaryGoal?: string | null;
};
```

#### 2.2 Internal normalization

- `normalizeMonthlySpend`:
  - Returns a string from the incoming `monthlySpend` (or `"0"` if null/undefined).
- `normalizeTrafficLevel`:
  - Returns `"High"` if input contains `"high"`.
  - Returns `"Medium"` if input contains `"medium"`.
  - Else `"Low"`.
- `hasCiCdEnabled`:
  - If boolean, returned as-is.
  - If string, considers `"yes"`, `"y"`, `"true"` as `true`, else `false`.

#### 2.3 Derived `CloudIntelligence` views

`computeCloudOperatorScores` calls `computeCloudIntelligence` three times with synthetic forms:

- **Cost-focused intelligence**

  ```ts
  computeCloudIntelligence("cost", {
    cloudProvider: hostingProvider,
    servicesUsed: projectType || hostingProvider || "general workload",
    estimatedMonthlySpend: monthlySpend,
    region: hostingProvider || "generic",
  });
  ```

- **Architecture-focused intelligence**

  ```ts
  computeCloudIntelligence("architecture", {
    cloudProvider: hostingProvider,
    appType: projectType || "Application",
    trafficEstimate: trafficLevel,
    dataStorageNeeds: "Primary application data and logs",
  });
  ```

- **Security-focused intelligence**

  ```ts
  computeCloudIntelligence("security", {
    cloudProvider: hostingProvider,
    publicServices: profile.publicExposure || "",
    complianceGoal: profile.complianceNeeds || "",
  });
  ```

#### 2.4 Outputs (`CloudOperatorScores`)

```ts
type CloudOperatorScores = {
  infrastructureReadinessScore: number;
  costEfficiencyScore: number;
  securityRiskLevel: "Low" | "Medium" | "High";
  ciCdMaturityScore: number;
  architectureComplexityTier: "Self-Serve" | "Growth" | "Enterprise";
  estimatedAnnualSavings: number | null;
};
```

##### 2.4.1 Infrastructure Readiness Score

- `infrastructureReadinessScore = architectureIntelligence.cloudMaturityScore`.

##### 2.4.2 Cost Efficiency Score (0–100)

- Starts at `baseEfficiency = 80`.
- If cost optimization opportunity is `"High"`:
  - `baseEfficiency = 50`.
- Else if `"Medium"`:
  - `baseEfficiency = 65`.
- Additional adjustments based on estimated annual savings:
  - If `estimatedAnnualSavings > 50,000`: `-10`.
  - Else if `> 20,000`: `-5`.
- Final:
  - `costEfficiencyScore` = clamped `[0, 100]`.

Interpretation: Higher savings potential implies **lower current cost efficiency**.

##### 2.4.3 Security Risk Level

- `securityRiskLevel = securityIntelligence.riskLevel` (inherits `"Low" | "Medium" | "High"`).

##### 2.4.4 CI/CD Maturity Score (0–100)

- Base:
  - `ciCdMaturityScore = 70` if `hasCiCdEnabled(profile.hasCiCd)` is true.
  - Else `30`.
- Adjustments:
  - `+10` if `gitProvider` is set and not `"none"`.
  - `+5` if `primaryGoal` contains `"scale"`.
- Final:
  - Clamped to `[0, 100]`.

##### 2.4.5 Architecture Complexity Tier

- `architectureComplexityTier = architectureIntelligence.complexityTier`.

##### 2.4.6 Estimated Annual Savings

- Carried through from the **cost-focused** `CloudIntelligence`:
  - `estimatedAnnualSavings = costIntelligence.estimatedAnnualSavings`.

---

### 3. Axiom `infrastructureScore` (Infrastructure Advantage Model™)

**Location:** `lib/axiom/infrastructureAdvantage.ts`  
**Function:**

```ts
function computeInfrastructureScore(scores: CloudOperatorScores): number
```

#### 3.1 Inputs

- `scores: CloudOperatorScores`
  - Uses:
    - `infrastructureReadinessScore`
    - `costEfficiencyScore`
    - `ciCdMaturityScore`
    - `securityRiskLevel`

#### 3.2 Risk mapping

- Axiom converts `securityRiskLevel` into a numeric “risk score” for the infra score computation:

```ts
const risk =
  scores.securityRiskLevel === "High"
    ? 0
    : scores.securityRiskLevel === "Medium"
    ? 50
    : 100; // "Low" or undefined
```

#### 3.3 Weighted composite

```ts
const readiness = scores.infrastructureReadinessScore || 0;
const cost = scores.costEfficiencyScore || 0;
const cicd = scores.ciCdMaturityScore || 0;

const raw =
  readiness * 0.4 +
  cost * 0.2 +
  cicd * 0.2 +
  risk * 0.2;

const infrastructureScore = round(clamp(raw, 0, 100));
```

- Weights:
  - `40%` Infrastructure readiness.
  - `20%` Cost efficiency.
  - `20%` CI/CD maturity.
  - `20%` Inverse security risk (higher risk lowers the score).

---

### 4. Risk Level Mapping

**Source:** `computeCloudIntelligence` (for `riskLevel`), reused in `CloudOperatorScores.securityRiskLevel`, then in Axiom.

- **Cloud Studio / base risk:**
  - `riskLevel: "Low" | "Medium" | "High"`.
  - Rules:
    - Security service type with public exposure:
      - `"High"` if there is strict compliance need.
      - `"Medium"` otherwise.
    - Architecture service type with public exposure:
      - `"Medium"`.
    - Else:
      - `"Low"`.

- **Cloud Operator:**
  - `securityRiskLevel = securityIntelligence.riskLevel`.
  - Same value as above, but from the security-specific Cloud Intelligence run.

- **Axiom:**
  - Uses `securityRiskLevel` to compute:
    - Numeric risk score:
      - `"High"` → `0`
      - `"Medium"` → `50`
      - `"Low"` or undefined → `100`
    - `riskExposureLevel` in `AxiomScores` / status response:
      - Carries through the string risk level (from Operator scores), used in UI as **Risk Level**.

---

### 5. Savings Estimation Rules

Savings are computed only in the cost-focused view and propagated through Operator and Axiom.

#### 5.1 Base estimation in `computeCloudIntelligence` (cost service type)

- When `serviceType === "cost"`:

  1. Parse `monthlySpend` from `form.estimatedMonthlySpend` (see §1.2).
  2. Compute annual spend:

     ```ts
     const annual = monthlySpend * 12;
     ```

  3. Determine optimization rate based on `optimizationOpportunity`:

     ```ts
     const rate =
       optimizationOpportunity === "High"
         ? 0.2
         : optimizationOpportunity === "Medium"
         ? 0.15
         : 0.1;
     ```

  4. Final savings:

     ```ts
     estimatedAnnualSavings = Math.round(annual * rate);
     ```

- For non-cost service types or `monthlySpend <= 0`:
  - `estimatedAnnualSavings = null`.

#### 5.2 Propagation to Cloud Operator

- **Cost-focused CloudIntelligence** is computed once in `computeCloudOperatorScores`.
- `CloudOperatorScores.estimatedAnnualSavings` is set from that result.

#### 5.3 Propagation to Axiom

- `AxiomScores.estimatedAnnualSavings` is simply:

```ts
estimatedAnnualSavings: operatorScores.estimatedAnnualSavings;
```

- The Cloud Operator status API exports:
  - `axiomEstimatedAnnualSavings`:
    - Prefers `AxiomScores.estimatedAnnualSavings`.
    - Falls back to `CloudOperatorScores.estimatedAnnualSavings`.
    - Falls back again to any cost estimate present in the operator output’s optimize module.

This keeps all savings calculations deterministic and rooted in a single base rule, while allowing for richer reporting layers in Operator and Axiom. 

