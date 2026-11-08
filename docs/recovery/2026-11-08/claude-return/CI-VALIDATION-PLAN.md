# Validation plan — one approved CI run (owner: Claude)

The project stays with Claude; it is **not** handed back to Codex. Local `npm ci` is blocked on Claude's Mac (`ENOTFOUND registry.npmjs.org`); it will not be retried until the network or environment changes. `node_modules` is never copied between machines.

## Chosen path: one draft pull request → GitHub Actions

GitHub is reachable from this Mac (clone and `ls-remote` work). Pushing a feature branch alone triggers **no** workflow; the Test workflow runs only on `main` pushes and pull requests. A draft PR from `claude/axiom-ci-test-repairs-2026-11-08` into `main` triggers exactly:

| Workflow | Why it triggers | Runner | Timeout | What it checks |
|---|---|---|---|---|
| Test | any PR | ubuntu-latest | 20 min | `npm ci`, `tsc --noEmit`, full Vitest, auth-recovery Python tests, `npm run build` (no deployment) |
| Website visual | `app/**`, `lib/**`, `tsconfig*.json` changed | ubuntu-24.04 | 20 min | website visual checks |
| Desktop CI | `lib/desktop/**` changed | ubuntu-latest + macos-latest | 30 + 30 min | desktop types/build/native validation |

Not triggered: owned-commercial PG acceptance and auth-recovery rehearsal (paths untouched), and all deploy, migrate and release workflows (dispatch or tag only). **No Vercel deployment**: `vercel.json` has `git.deploymentEnabled: false`.

**Worst-case cost** (every job runs to its timeout): 70 Linux minutes + 30 macOS minutes. At conservative assumed rates of $0.008 per Linux minute and $0.08 per macOS minute, that is about **$2.96**. The prior Test + Desktop run was estimated at $0.48 when it stopped. These are estimates, not an invoice, and any remaining free minutes would reduce them.

Rules for the run: one PR, one run of each workflow, no re-runs, no merge. A failure stops the run; Claude fixes it locally, then asks again before any new push.

## What the user must do (smallest action)

1. Approve a **$3 cap** for this one run.
2. Let Claude open the PR. `gh` is not signed in on this Mac, so either run `gh auth login` once, or open the draft PR yourself in the browser after Claude pushes the branch.

The cheaper alternative, under about $1, is to cancel the macOS Desktop job. It isn't recommended: CLAUDE.md lists desktop validation as a pre-push gate.

## Alternative without spend

An approved internal npm mirror URL (for example the company's Artifactory) would let Claude run everything locally for free. Claude can't discover it, because `~/.npmrc` is outside its read permissions.

## After CI passes

Validation covers types, tests and the production build. Deployment still waits for the production database compatibility check (`admissionContract`, `quoteEvidence`, recovery, cutover). Its first step is the approved one-call diagnostic, and that needs a Vercel connection usable from this session (see `../preflight-diagnosis/AUTHORIZATION.json`).
