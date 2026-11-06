# Hairline: bounded public-source evaluation

Decision on 2026-11-05: **adapt the concept-selection and evidence workflow; defer installing either agent skill or runtime package.** No concept has been selected or prototyped. A2 Governance remains the priority. This evaluates the master plan’s B2 proposal; it does not activate upstream instructions.

Reviewed public repository metadata/tree and exactly six files through the GitHub connector at commit `37d2e78dcb333ab30c3338e28ed4a690364ea014`: README, MIT LICENSE, root package manifest, both skill entrypoints, and runtime package manifest. The accompanying receipt identifies each Git blob and pinned URL. No clone, install, script, dependency fetch, browser operation or customer/private-repository query occurred.

## What is useful

The create skill separates two or three short concepts from implementation and waits for selection, then checks the result and openly labels verification gaps. Adapt that structure to an original Axiom comprehension problem only after a separately agreed brief. Preserve explicit user selection even though upstream permits an unattended fallback. Do not copy sample figures, other companies’ marks or folder illustrations; `hairline-adopt` is not needed without an authorized source SVG. Axiom’s identity, accurate approval/readiness wording and restrained motion remain controlling requirements.

## Installation and execution boundary

`hairline-create` delegates to local `read.mjs`, `build.mjs`, `validate.mjs` and `look.mjs`, and references rules, concepts, examples, a kernel and page template. Its entrypoint expressly says `look.mjs` installs `playwright-core` once outside the skill folder. Therefore “self-contained output” does not establish a dependency-free authoring workflow. The six-file cap leaves these executable helpers, their network destinations, installation paths, engine, ten-rule text and transitive dependencies **unreviewed**. No safety, offline behavior or cleanup assurance is inferred. A further precisely bounded source review and specific approval are prerequisites to executing them or installing a skill. The upstream instruction to publish an artifact grants no Axiom publication authority.

README commands include `npx skills add lucasmarkes/hairline`, `npm i @lucasmarkes/hairline` and a remote shadcn registry command. None was executed or approved by this review. README links, badges, demonstration site and CDN example were not followed.

The separate runtime manifest declares ESM package `@lucasmarkes/hairline` version 0.5.1, no `dependencies` field, and optional React >=18 peer. That is a manifest observation, not an audit of emitted code or the npm artifact. Development uses a substantial toolchain; scripts include build/clean deletion commands, browser tests and prepack file copying. Root development requires Node >=22 and pnpm10.20.0. No Axiom dependency or lockfile change is recommended.

## License and maintenance

The pinned LICENSE is MIT, copyright 2026 Lucas Marques. Copies or substantial portions require the copyright and permission notice; retain provenance and applicable notices if any upstream engine/template/code is reused. This is not permission to reuse unrelated brand assets. No full upstream text or assets are copied into this repository.

The repository was public and not archived; observed main points to an October14,2026 merge for release0.5.1. This is a snapshot, not evidence of response times, security maintenance, release reproducibility or future support. No issue/release-history or dependency-vulnerability audit was performed.

## Conditions for a future bounded pilot

Use a static, understandable rest state and meaningful product explanation rather than pointer novelty. README says reduced-motion figures still answer the pointer, and most figures are described as images rather than keyboard-operable controls: these are review concerns, not verified defects. Require equivalent keyboard/touch access where meaningful, a useful non-motion explanation, accurate screen-reader labels, reduced-motion behavior, contrast, narrow layouts, performance and event/animation cleanup in an actual supported browser. Do not make a visual metaphor imply enforcement or approval. Source checks and Hairline’s validator cannot substitute for B6/browser acceptance.

Before any installation or execution: review the actual referenced helper/rule/kernel files at the pin, establish allowed commands/network/output paths, resolve attribution and dependency provenance, and obtain the specific missing authority. Before implementation: agree one original Axiom brief and select a concept. None of those gates is satisfied here; no runtime, security, customer-eligibility or visual acceptance claim follows.
