# Recover the latest verified local Axiom source

The private `backup/axiom-progress-2026-10-30-1743` branch contains the ongoing local work, including reviewed but unreleased Governance/security code. It is distinct from main, production, public installers and the immutable October29 baseline branch. Follow the master plan and individual receipts to distinguish verified source from unfinished or unactivated features.

With an account authorized for the private repository:

```sh
git -c core.autocrlf=false clone --branch backup/axiom-progress-2026-10-30-1743 https://github.com/sahme209/visionxixlabs.git axiom
cd axiom
git rev-parse HEAD
git log -3 --oneline
git switch -c codex/recovered-work
```

Compare the recovered commit to the latest verified private-backup receipt. The October29 `source-files.json` verifier applies only to its original dated baseline, not this newer branch. Existing incremental bundles are additional local recovery evidence; GitHub is the remote source backup. Do not overwrite or delete historical backup branches.

Source includes local package code and lockfiles, but not node_modules, build outputs, raw working logs, credentials, signing private keys, Keychain items, paired sessions or database contents. Restore needed secrets only from existing secure providers. Database/Neon branches and backups remain separate and must be preserved. A source clone is not a tested database restore or laptop disk image.

Use the recorded Node24.21.0/native toolchain and lockfiles. The isolated package-build tooling deliberately refuses missing offline dependencies or independently unverified engines; an unavailable result is not permission to disable its checks. Ordinary recovery does not authorize paid CI, deployment, migrations, recovery SQL, provider actions, new grants, expired approvals or replay of consumed attempts. In particular, the already-written unknown ServiceNow note must not be resent.

Start with `docs/product/axiom-master-action-plan.md` and the November2 verification/progress receipts. Public v0.1.21 and its accepted download evidence are historical release facts; they do not imply that newer local features are shipped or that current connections remain authorized.
