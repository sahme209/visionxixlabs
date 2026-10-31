# One bounded v0.1.22 build and draft export

The user authorized one Vercel batch and up to $2 additional GitHub Actions spending for one cross-platform v0.1.22 build. No CI run or new tag has started.

Existing private tag pushes build candidates only. Manual draft-export dispatch additionally requires the exact private tag, so simply pushing the tag then dispatching would create two builds. Do not consume the allowance that way.

Proposed local workflow adjustment: permit the existing draft-export job to consume the same successful tag-triggered run ONLY for refs/tags/desktop-v0.1.22 when github.sha equals a temporary AXIOM_DESKTOP_DRAFT_EXPORT_SOURCE whitelist and the existing AXIOM_DESKTOP_DRAFT_EXPORT_READY switch is true. Source/version/tag checks, all four platform builds, real macOS package verification, same-run artifact graph/digests, GPG signing, existing-identity refusal and protected public human approval remain. No new token, grant or admin bypass. Preserve manual flow for other versions. Restore the readiness switch and temporary whitelist afterward.

Normalize new flattened asset filenames before manifest signing/upload, preserving every installer byte, to prevent the previously reproduced GitHub-space renaming mismatch. Do not modify v0.1.21 or any immutable release.

Bound export to5 minutes and private artifacts to3-day retention. Existing matrix10-minute Mac/20-minute Windows+Linux caps stay. Standard runner rates checked against GitHub's official pricing: macOS$0.062/minute, Windows$0.010, Linux$0.006. Bound normal compute approximately$1.762 before cancellation cleanup/rounding; reserve storage/publication headroom and cancel owned run near$1.72 estimated compute. No retry. Billing API lacks existing user scope; do not expand credentials to query it. Actual invoice is not claimed from duration estimates.

This changes the candidate-only tag trigger boundary for one explicitly whitelisted source, so the existing validation-first requirement calls for approval before enabling it. Public release still requires the user's own protected-environment approval after exact assets are verified. No workflow publication bypass is authorized.
