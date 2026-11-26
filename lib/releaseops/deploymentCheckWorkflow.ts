/**
 * Generates a GitHub Actions workflow that runs a workspace's deployment checks in the
 * customer's own CI (pure, no I/O). V19 never runs checks; this file is reviewed and merged by
 * the customer like any other change. Values are inserted only as JSON-quoted env values, never
 * into shell text, and every input has already passed the strict per-kind validation.
 */
import type { CheckKind, CheckStage } from "./deploymentChecks";

export const CHECK_WORKFLOW_PATH = ".github/workflows/v19-deployment-checks.yml";

export interface GeneratableCheck { key: string; name: string; kind: CheckKind; stage: CheckStage; mode: "blocking" | "advisory"; enabled: boolean; version: number; spec: Record<string, unknown> }
export interface GeneratedWorkflow { path: string; yaml: string; included: string[]; skipped: Array<{ key: string; reason: string }> }

const q = (v: unknown) => JSON.stringify(String(v));
const jobId = (key: string) => `check_${key.replace(/-/g, "_")}`;

function job(c: GeneratableCheck): string[] | { skip: string } {
  const head = [
    `  ${jobId(c.key)}:`,
    `    name: ${q(`${c.name} (${c.stage}, ${c.mode})`)}`,
    `    if: inputs.stage == '${c.stage}' || inputs.stage == 'all'`, // stage is a closed enum; Actions string literals need single quotes
    `    runs-on: ubuntu-latest`,
    `    timeout-minutes: 15`,
    ...(c.mode === "advisory" ? [`    continue-on-error: true`] : []),
    `    env:`,
    `      V19_CHECK_KEY: ${q(c.key)}`,
    `      V19_CHECK_VERSION: ${q(c.version)}`,
    // Job-level so the report step's \`if\` can see whether it is configured (step env is not visible there).
    "      V19_API_KEY: ${{ secrets.V19_API_KEY }}",
  ];
  const s = c.spec;
  switch (c.kind) {
    case "smoke_test":
      return [...head,
        `      CHECK_URL: ${q(s.url)}`, `      EXPECT_STATUS: ${q(s.expectStatus)}`, `      MAX_LATENCY_MS: ${q(s.maxLatencyMs)}`,
        `    steps:`,
        `      - name: Probe`,
        `        run: |`,
        `          set -euo pipefail`,
        `          out=$(curl -sS -o /dev/null --max-time 30 -w '%{http_code} %{time_total}' "$CHECK_URL")`,
        `          code=\${out% *}; secs=\${out#* }`,
        `          ms=$(awk -v s="$secs" 'BEGIN { printf "%d", s * 1000 }')`,
        `          echo "status=$code latency_ms=$ms"`,
        `          test "$code" = "$EXPECT_STATUS" || { echo "::error::Expected $EXPECT_STATUS, got $code"; exit 1; }`,
        `          test "$ms" -le "$MAX_LATENCY_MS" || { echo "::error::Latency $ms ms above $MAX_LATENCY_MS ms"; exit 1; }`];
    case "custom_script":
      if (s.runner !== "github_actions") return { skip: "runs on your own runner; add it to that runner's pipeline" };
      return [...head, `      SCRIPT_PATH: ${q(s.scriptPath)}`,
        `    steps:`,
        `      - uses: actions/checkout@v4`,
        `        with:`,
        `          persist-credentials: false`,
        `      - name: Run script`,
        `        run: bash "$SCRIPT_PATH"`];
    case "migration_dry_run":
      return { skip: `runs in its own workflow (${String(s.workflowPath)}, job ${String(s.job)}) so its database access stays separate; start it there for this stage` };
    case "health_check":
      return { skip: "evaluated by your monitoring; report its result with POST /api/v1/checks/results" };
    case "manual_checklist":
      return { skip: "confirmed by a person in V19, not in CI" };
  }
}

/** Record the job start so the report can include a duration. */
function withStartTime(lines: string[]): string[] {
  const i = lines.indexOf("    steps:");
  return [...lines.slice(0, i + 1), "      - name: Start timer", "        run: echo \"V19_STARTED_MS=$(date +%s%3N)\" >> \"$GITHUB_ENV\"", ...lines.slice(i + 1)];
}

/**
 * Report the job's outcome to V19 as evidence, even when an earlier step failed. Skipped when
 * the repository has no V19_API_KEY secret, so the checks still run without V19 configured.
 */
function reportStep(c: GeneratableCheck): string[] {
  return [
    "      - name: Report result to V19",
    "        if: always() && env.V19_API_KEY != ''",
    "        env:",
    "          V19_URL: ${{ vars.V19_URL || 'https://visionxixlabs.com' }}",
    "          JOB_STATUS: ${{ job.status }}",
    "          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
    "          RUN_KEY: ${{ github.run_id }}-${{ github.run_attempt }}",
    `          CHECK_STAGE: '${c.stage}'`,
    "        run: |",
    "          case \"$JOB_STATUS\" in success) status=passed ;; failure) status=failed ;; *) status=error ;; esac",
    "          duration=$(( $(date +%s%3N) - ${V19_STARTED_MS:-$(date +%s%3N)} ))",
    "          jq -n --arg key \"$V19_CHECK_KEY\" --argjson version \"$V19_CHECK_VERSION\" --arg stage \"$CHECK_STAGE\" --arg status \"$status\" \\",
    "            --argjson duration \"$duration\" --arg run \"$RUN_URL\" --arg idem \"$RUN_KEY-$V19_CHECK_KEY\" --arg ref \"$GITHUB_SHA\" \\",
    "            '{checkKey:$key, checkVersion:$version, stage:$stage, status:$status, durationMs:$duration, runUrl:$run, idempotencyKey:$idem, releaseRef:$ref}' \\",
    "          | curl -fsS --max-time 20 -X POST -H \"Authorization: Bearer $V19_API_KEY\" -H 'Content-Type: application/json' --data @- \"$V19_URL/api/v1/checks/results\"",
  ];
}

export function generateCheckWorkflow(checks: readonly GeneratableCheck[]): GeneratedWorkflow {
  const included: string[] = []; const skipped: GeneratedWorkflow["skipped"] = []; const jobs: string[] = [];
  for (const c of [...checks].sort((a, b) => a.key.localeCompare(b.key))) {
    if (!c.enabled) { skipped.push({ key: c.key, reason: "disabled" }); continue; }
    const out = job(c);
    if ("skip" in out) { skipped.push({ key: c.key, reason: out.skip }); continue; }
    included.push(c.key); jobs.push([...withStartTime(out), ...reportStep(c)].join("\n"));
  }
  const yaml = [
    "# Generated by V19 from this workspace's deployment checks. Review it like any other change.",
    "# V19 does not run these checks; they run here, in your CI.",
    "name: V19 deployment checks",
    "",
    "on:",
    "  workflow_dispatch:",
    "    inputs:",
    "      stage:",
    "        description: Release stage to check",
    "        required: true",
    "        type: choice",
    "        options: [all, plan, validate, approve, deploy, verify, recover]",
    "",
    "permissions:",
    "  contents: read",
    "",
    "jobs:",
    jobs.length ? jobs.join("\n\n") : "  no_checks:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"No CI-runnable checks are enabled.\"",
    "",
  ].join("\n");
  return { path: CHECK_WORKFLOW_PATH, yaml, included, skipped };
}
