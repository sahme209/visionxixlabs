# Repositories: choose local source and clone an authorized GitHub repository

Help ID: `repositories.acquire-source` · **Internal unpublished source draft** · Source `06afd3eac50f2e021dd084b19e67fb7d6fd51518`, November3,2026. Customer eligible: **false**. Publication approved: **false**. Exact inspected files are bound in `repository-acquisition-controls.sources.json`. No native walkthrough, provider access, screenshots, demo or shipped-version acceptance is supplied.

## Where this screen actually lives

The customer **Repositories** destination is `repository-workspace`: `App.tsx` imports and mounts `RepositoryWorkspaceView`, passing current paired identity/workspace and Agent navigation. Agent and repository panes may also share the workspace. `RepositoriesView.tsx` is a separate legacy inventory/register/sync component, not this current App mount. Its362lines do not document this screen. This article covers only **top-level acquisition, local checkout selection and source refresh** from the903line workspace; it does **not** mark the whole workspace documented.

## Starting state and actual effects

On mounting a current workspace session, Axiom reads its default local repository folder and immediate local repository inventory, and requests the connected GitHub repository catalog. Selecting a checkout then reads local Git status, files and supported-check definitions; detection is distinct from running a check. Current-session/repository generations prevent stale asynchronous results from replacing a newer selection. This is not evidence that an already-started native process was canceled.

The default folder is the user's `AxiomAgent/repos` under their home folder. The local inventory lists immediate directories with a `.git` directory; it is not a recursive filesystem search and this article does not promise bare repositories or arbitrary `.git`-file worktrees will appear as roots. A remembered worktree is restored only after fresh root/worktree inventory confirms it. If unavailable, Axiom may select an available repository and warns to review its name before editing.

## Source and navigation controls

| Actual control | What it does and what it does not do |
|---|---|
| **Clone or refresh repositories** | Expands/collapses the source controls. It is initially open for a noncompact workspace without a selection. Expansion is not connection consent or clone execution. |
| **Connected GitHub repository** / visible label **Clone source · GitHub** | Selects a returned repository and shows its visibility. Choice alone sends no clone and grants no additional access. Catalog preference is optional local navigation metadata, not permission. |
| **Enter another authorized repository…** → **Repository owner and name** | Enables manual `owner/repository` entry. This is **not** a general remote-URL field and does not add GitLab/Azure support. Being absent from the loaded catalog does not grant access; the backend still checks actual GitHub App repository scope. |
| **Refresh connected repositories** | Performs another catalog request. It is not a new provider connection/consent screen. The button is not disabled by the workspace's shared busy state; only the latest current catalog response is applied. |
| **Local repositories folder** | Edits the parent-directory text used by Refresh and as the clone destination parent. This screen has no folder picker or separate Open-folder/Connect-provider button. Typing does not itself scan, clone or change routing. Do not enter secrets. |
| **Clone** / **Cloning…** | Requests the current repository credential with purpose `clone`, then invokes native Git clone into `parent/repository-name`. This reads GitHub **and writes local files/directories**, so it is not a purely read-only action. It does not merge, push or deploy. It is disabled during shared busy state or an invalid/not-listed nonmanual selection. The handler additionally refuses an empty parent folder. |
| **Refresh** | Lists repositories in the entered local parent folder and resolves a current/remembered selection. Disabled while busy or the parent is empty. This is local inventory, not Git fetch/pull. It may select a different available checkout; inspect the scope strip. |
| **Local repositories** list row | Selects that local checkout. If the current loaded file contains unsaved edits, **Switch repositories?** offers **Discard and switch** or **Cancel**. Cancel preserves the current selection; confirmation discards that editor buffer, not saved Git history. |
| Scope strip **Local**, checkout name, branch; **View … changed files** | Displays the selected local scope. The changed-count control opens the Changes navigation; a count is recorded status, not current test/release approval. |

Local navigation storage contains paths keyed to API base/workspace/user and a separate preferred repository name; it stores neither file contents nor credentials. A stored path is a hint, not filesystem authority or verification evidence. Storage failure leaves session-only navigation available.

## Connection requirements and clone credential limits

Catalog reads use the current paired desktop session and `github:read`, with API keys disallowed, and the organization's active GitHub App installation. Returned metadata is not a universal inventory of every Git provider. The UI can show **No connected repositories**, an unavailable-access warning directing the user to Settings → Integrations, and a truncated-catalog notice. The current UI text says “first100”; the actual backend uses its own bounded paginated collection, so that wording is not asserted as a server-enforced universal total here. Existing local files remain available when catalog access fails.

Clone-token issuance currently requires a current paired session, accepted workspace access and **`github:write` capability even for purpose `clone`**; do not simplify this to “any read-only user can clone.” The resulting purpose-clone provider token uses `contents_read`, is bound to the actual organization/repository installation and checked again before the response. Its purpose does not authorize a push. This distinction matters: local checkout writes and backend capability requirements differ from the provider token's contents-read scope.

The credential-bearing URL passes from the backend to the desktop/native command. Native Git strips the credential from its command arguments/origin URL, uses child-only Git authorization configuration, disables credential helpers/prompts and trace sinks, and redacts relevant output. The success notice says **Cloned … without storing its access token**; this means the inspected origin/helper path, not a proof of zero process-memory exposure or instant token revocation. Never paste, copy or log a credential-bearing URL. Pending/issued write-token leases in the push branch do not make every old native token tracked, and expiry/revocation cannot be inferred from UI closure. Clone does not qualify Governance enrollment or complete execution coverage.

## Busy, failures, cancellation and uncertainty

A clone sets the shared busy label, clears old notices/errors and invalidates previous verification freshness. On confirmed native return, the UI refreshes local inventory, selects the destination and displays the clone notice. A network/native error is shown in the shared alert; stale-owner results are not applied. A failed credential request or lost response is not an instruction to repeat automatically.

Native clone refuses a destination that already exists. It may create the parent directory. On reported clone failure it attempts to remove only the destination it had checked absent; failure of that cleanup is not proven away by the UI. Origin-canonicalization failure also attempts removal. If the result is uncertain, inspect the original destination and current local inventory through supported controls before another deliberate action; do not delete an existing checkout or blindly press Clone again.

There is **no clone Cancel button or documented clone deadline** in this top-level source path; the native scoped Git helper waits for its child output. **Stop check (direct child only)** belongs to the separate verification workflow and does not cancel cloning. Navigating away/context change retires UI ownership; it does not certify that a submitted Git process stopped or that no files/credentials were produced. Closing the source disclosure also does not cancel a clone. No automatic clone retry is described or authorized.

## Explicit remaining documentation and qualification work

Nested editor/file filtering/search/replace/undo/save, Agent draft loading and local creation, worktree management, checks/cancellation/output, branch/pull/push/commit, publish-PR confirmation and diff controls remain **outside this article and unfinished B4 coverage**. They require their own exact source/effect/recovery guides. This is not a complete903line-screen audit or control-by-control binding. Current native visual/keyboard/accessibility testing, genuine editorial review, safe screenshots/demo, actual supported release mapping and approved retrieval entry are still required before customer use. Do not promote this draft or infer current provider/credential health from historical tests.
