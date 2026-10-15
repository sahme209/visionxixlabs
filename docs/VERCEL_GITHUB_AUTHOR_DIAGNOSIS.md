# Vercel GitHub author diagnosis · 2026-10-15

The correct GitHub account is `sahme209` (account id `225285479`) and the
repository is `sahme209/visionxixlabs`.

## Verified account and integration evidence

- The authenticated GitHub connector identifies account `sahme209`.
- Vercel project `visionxixlabs` links to GitHub `sahme209/visionxixlabs`.
- Vercel's GitHub namespace reports unrestricted access and an admin viewer.
- The confirmed Vercel team owner is linked to GitHub login `sahme209`.
  Its separate Vercel username is not evidence of a GitHub username mismatch.
- Main merge commit `7316be61` resolves to GitHub account `sahme209`.
  Its Git-triggered production deployment `dpl_8Pghk2udZ5MnaGchysd21zJWjkRa`
  is READY. This was an existing deployment, not a release performed by this
  investigation, and it is not proof of working production login.

## Commit-author correction

GitHub returns no associated account id for the author of workspace commit
`76e4c4f1`; the connector falls back to the raw author name. The repository's
previous local author email therefore does not demonstrate GitHub association.
The account profile and correctly associated merge commit use a different
address. Private account email verification settings are not exposed here.

Future commits in this cloud clone now use the account-specific GitHub address
`225285479+sahme209@users.noreply.github.com`. The author display name is kept.
Only repository-local Git configuration changed; no account email, credential,
GitHub installation, Vercel permission or project link was modified. Existing
commits are preserved, with no amend, rebase or force push. Main was merged
locally into the integration branch using a new merge commit; the file tree
was identical before and after that merge.

## Remaining deployment distinction

The previous integration preview `dpl_6XWGTx4q7XUpafUWVG6PkPwc8ic3` failed
before build with `BUILD_FAILED: Resource provisioning failed`. Missing author
association plausibly explains the reported “GitHub user not found” warning,
but the exposed deployment error does not establish that it caused provisioning
failure. A new correctly attributed branch commit is the verification step.
Production deployments, aliases, protection, credentials and database records
remain unchanged. Production preflight and founder/login verification remain
separate gates in the unified mission.
