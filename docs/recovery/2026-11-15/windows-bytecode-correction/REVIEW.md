# Windows source-inventory setup correction

The original run43759916697/job132953540371 at2eefbc4 refused before installation because its own helper import created an untracked bytecode file. FIRST-RESULT.json preserves the observed failure; it is not installer acceptance.

The controller disables bytecode before local imports. Its sanitized child environment adds the fixed literal PYTHONDONTWRITEBYTECODE=1 so the independent downloader process and later Python helpers cannot create source-tree caches. Ambient Python options remain excluded. The subprocess regression starts without ambient bytecode variables, proves no cache, removes only the temporary fixture guard to reproduce actual helper cache creation, then checks a fresh downloader import without network or main execution. No inventory exclusions, manifest relaxation, platform skip or cleanup weakening.

Root verification: 51 Windows harness tests PASS, five V19 identity tests PASS, 15 demo contract tests PASS, git diff --check PASS. Independent release_batch_review: CLEAR on the exact two-file correction including the separate downloader process. Source binding remains ordinary owner PR CI, not independent human approval proof. The final source manifest is regenerated last. A changed-source original-attempt same-PR run is required; unchanged failed run is not retried. Native windows/macOS/Linux checks passed on the previous source but actual installer, upgrade and collision execution still must pass.

No Vercel build/deployment, database/settings/credential read, publication/signing or production change. Real Google sign-in, desktop pairing and working public app downloads remain required and UNVERIFIED. Product work and Windows come before Governance; Governance remains incomplete/disabled.
