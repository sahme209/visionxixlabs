# Production-dependency audit observation — no clean-audit claim

PR #321 CI job `130853264346` ran `npm audit --omit=dev --audit-level=high` for web and desktop. Its threshold passed, but web reported three moderate findings in the archiver → readdir-glob → minimatch chain, advisory GHSA-g3hv-75wg-m249 (globparts amplification denial of service). Desktop reported zero findings. This is not “zero vulnerabilities” for the web.

The relevant locked versions are identical to main `a99c053f`: archiver 8.0.0, readdir-glob 3.0.0, nested minimatch 10.2.6. This migration did not introduce a version change in that chain. The report's force recommendation would downgrade archiver to 7.0.1, a breaking change; it was not executed. No lockfile was hand-edited.

Source references include `lib/leads/scaffoldGenerator.ts` (archive.directory) and `lib/cloudOperator/buildExportPack.ts`. Actual exploitability and a compatible fix are not established. Add a targeted source/patch triage to remaining security work after the current ordered PR, preserving archive behavior and generated lockfile review. Do not suppress audit rules, force a downgrade or declare the application unaffected without evidence.
