# One final Vercel production deployment gate

Owner instruction recorded October 16, 2026. This policy supersedes any plan to
release intermediate PRs or main revisions. No deployment is authorized now.

- Continue source pushes, PRs, required CI and verified merges normally. Preserve
  repository automatic-deployment suppression and the currently serving website.
- Do not trigger Vercel builds, preview deployments, production deployments,
  promotions or routing changes for individual changes. Do not change project
  settings, Git integration, domain or secrets as a workaround.
- Prepare one final production candidate only after all intended website changes
  are merged into main and required security, billing, authentication, database
  recovery and CI checks pass. Unverified customer/provider workflows remain
  explicit blockers; passing unit tests alone cannot satisfy them.
- Before any deployment, present the exact full main commit SHA and clean CI runs,
  included features and website scope, outstanding blockers, effective production
  database binding and recovery evidence, verified authentication and billing
  acceptance, security review and rollback plan. Distinguish source verification
  from serving-production proof. Re-evaluate the report if candidate source moves.
- Identify the currently serving immutable deployment and its configuration/schema
  compatibility before defining rollback. A previous code deployment is not a
  database rollback. Specify rollback trigger, authorized operator, validation and
  any separate routing approval; do not promote or test rollback in production.
- Wait for explicit final owner approval of that exact candidate and deployment
  operation. A PR merge, test pass, report acceptance or earlier engineering
  authorization is not final deployment approval.
- Desktop publication, database migrations/recovery, production payment/pricing
  changes, secrets and infrastructure retain their independent approval gates.
  Final website approval does not authorize any of those operations.

The eventual approved manual deployment must select the exact reviewed commit,
retain normal build/security controls, and verify the resulting deployment before
any separately authorized production routing operation. The supported manual
mechanism and automatic-deployment bypass must be reviewed in the candidate
report; no trial Vercel deployment is authorized by this document.
