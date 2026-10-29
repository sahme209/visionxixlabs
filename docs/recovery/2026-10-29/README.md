# Axiom full source recovery snapshot — October 29, 2026

This private backup branch preserves the complete current tracked website/backend/desktop source, lockfiles, migrations as source, tests, workflows, and unfinished ticket-governance work. It is a recovery checkpoint, NOT an approved production release. Main, the published v0.1.21 installers and Vercel are not changed by this backup. Git-triggered Vercel deployment is disabled in vercel.json; the backup commit skips CI and does not create a release tag or pull request.

## Restore on another computer

Authenticate to GitHub as an account authorized for the private sahme209/visionxixlabs repository. Then:

```sh
git -c core.autocrlf=false clone --branch backup/axiom-full-2026-10-29 https://github.com/sahme209/visionxixlabs.git axiom
cd axiom
python3 docs/recovery/2026-10-29/verify-recovered-source.py
```

The verification command checks every application/source file from the snapshot against its recorded SHA256, without executing the app, contacting providers or modifying a database. Preserve the backup branch; create a separate working branch for new work.

Install the required Node/Rust/native build tools and dependencies using package-lock.json and Cargo.lock. Restore only the needed environment values from their existing secure providers; .env.example names settings but contains no working credentials. Do not run migrations, recovery SQL, deployment scripts or provider mutations merely to restore source. Review pending work and current cloud state first. Native paired sessions may need a fresh sign-in.

## What this Git backup deliberately does not contain

Passwords, OAuth/access tokens, signing private keys/certificates, local .env files, macOS Keychain items, database contents, node_modules, native build targets, installers, caches and raw operational logs are not committed. GitHub Actions secrets and Vercel settings live in those services, not in a clone. Database data and provider connections remain in their respective cloud services and require their own backup/recovery arrangements. This is a complete source-code checkpoint, not a laptop disk image or a tested database disaster-recovery exercise. Never upload credentials to Git to fill these gaps.

Published installers and their immutable signature/hash manifest remain at:
https://github.com/sahme209/axiom-releases/releases/tag/desktop-v0.1.21
The customer download page is https://visionxixlabs.com/download#downloads.

See STATUS.md for exact accepted and unfinished work, and receipts/ for bounded verification records. Source-files.json covers the application source at backup time; recovery documents themselves are additional files tracked by Git.
