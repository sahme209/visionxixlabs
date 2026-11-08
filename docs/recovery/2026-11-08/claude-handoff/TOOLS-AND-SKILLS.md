# Tools, plugins and skills for Claude

This register distinguishes workflows actually used/read during Codex work from candidates discussed in the master. It is not a claim that every installed plugin was used. Codex tool names are not necessarily available in Claude; use Claude's authenticated equivalent after checking access. No new install, OAuth scope, key access, service, spend or execution authority is granted by this list.

## Used/read skills — local source locations

The following Superpowers workflow skills were used in this work history or read for this repair/handoff: systematic-debugging, dispatching-parallel-agents, test-driven-development, requesting-code-review, verification-before-completion, brainstorming and executing-plans. Exact directory:
`/Users/samirahmed/.codex/plugins/cache/openai-curated-remote/superpowers/7.0.1/skills/<name>/SKILL.md`.

Use debugging before fixes, meaningful failing cases before behavior changes, independent review for high-risk boundaries, and verification before completion claims. Parallel work is user-authorized; one owner per file group, no agents changing production/credentials or claiming their mocks prove live acceptance. User approvals override inferred extra approval checkpoints, while explicit scoped/security/spending limits remain intact.

Relevant Vercel instructions read in the history/current release task:
- deployments-cicd: `/Users/samirahmed/.codex/plugins/cache/openai-curated-remote/vercel/0.54.1/skills/deployments-cicd/SKILL.md`.
- env-vars: same Vercel root, `env-vars/SKILL.md` (prior production metadata/preflight guidance).
Relevant Neon instruction source used for earlier database planning: `/Users/samirahmed/.codex/plugins/cache/openai-curated-remote/neon-postgres/3.0.1/skills/neon/SKILL.md`. Read the more specific `neon-postgres/SKILL.md` if applicable, do not assume it was executed for this handoff.

These local skill paths are readable source instructions, not installed Claude plugins. Do not copy/install automatically or assume Codex-specific helper tools exist in Claude. A skill's generic deploy instruction does not waive Axiom's specific database/security approval gates.

## Used tools / plugin families

| Tool or plugin | Actual use and boundary |
| --- | --- |
| GitHub integration + local Git and authenticated `gh` | Source/commit/ref/workflow inspection; private backup and user-authorized fast-forwardmain push; run/job/error inspection; remainingrun cancellation afterfailure. No PR created. Future pushes can trigger paidCI. |
| Vercel MCP | Previous explicit release operations; current bounded metadata/preflight. `filter_project_envs`/conditional`get_project_env` need private sensitive handling. NewNov8attempt returned unverified; no deployment. Do not echo raw responses. |
| Neon PostgreSQL MCP | Prior approved schema/isolated/source-backed planning and production metadata protocols. Conditional preflight uses exact project/branch/compute metadata and readonlytransaction only AFTER endpoint join. This handoff has NO new successful DB observation. Never substitute old/defaultbranch or call get_connection_string. |
| Unified computer-use / in-app browser (`cua`) | Genuine local preview/native observations, screenshots and supported controls. Requires fresh state after interruptions; do not bypass disabled browser/screenlock/OSpicker. No impersonated human review. |
| Web / official documentation search | Approved bounded official Apple, Prisma, Vercel/AI SDK/Anthropic reads and current GitHubActions pricing. No general external-read permission, scraping competitor assets or new paidresearch. |
| Functions / local shell / Python | Hash-bound orchestration, source reads/edits, safe output projection, scoped test supervision and receipt preservation. Never send secret URIs to shell/files/argv/IPC. |
| Node/TypeScript/Next/Vitest/React Testing Library | Existing cached local app builds/types/synthetic tests. Productiontsconfig and fulltesttsconfig differ; verify both, do not hide live tests to makeCIgreen. |
| Rust/Cargo/Swift/C/Objective-C/Apple CLT | Prior separately approved offline/native compile/stub units; exact scoped signing with existing company key; pureMach-O/file observers. Ordinary test privilege does not authorize realSecurity/Keychain/service/install or signing. |
| Code-signing/hdiutil/macOS sandbox tools | Historically authorized exact staticartifact units, consumed. No new signing/mount/runtime grant inferred. MemoryACLunit excludes these. |

## Design/motion tools — evaluated/planned, not all used

Master B2/B6 is authoritative, including Cursor,Claude,ChatGPT/Codex,Grok,Harness/Apple inspiration, original deployment imagery, accessible hover/focus, reducedmotion and fullbrowser validation. Do not copy competitor artwork/layouts or invent a real demo from a scripted illustration.

The local tooling assessment is `docs/recovery/2026-11-03/web-quality-tooling/README.md`. It distinguishes Taste Skill,Web Design Guidelines,Awesome Design,Image-to-Code,Playwright,React Bits,GSAP,Lenis,GetLayers,Prompt Motion,Hairline andTeardown. Figma,MagicPath,Adobe,imagegeneration and other available Codex plugins are NOT proven used merely because available. Hairline/Teardown are the specific design/3Dreference tools the user named, not synonyms for CSSborders or code cleanup; identify exact product/source/license/access before adoption. Read the master and assessment instead of guessing. Native scrolling stays default; useGSAPonly whereCSSis insufficient and auditReactBitslicense. Do not installPlaywright/browsers via npx without permission. Actualbrowser observations so far are representative, not fullB6.

## Future product integrations — separate from tools used to build Axiom

Preserve the entire master roadmap: Terraform/HCP,Vault,OPA,EntraID,Okta,Datadog,Confluence,SharePoint,Kubernetes,Slack,Backstage,Airflow plus Grafana,Dynatrace and the other later batch/release/service requests. These product integrations are not automatically available MCPtools, completed connectors, or authorized new implementations. Existing Outlook discovery/settings and desiredGitLabconnector/GitLabsignin are separate scope. Keep planned,local-only,disabled andlive-accepted labels honest.
