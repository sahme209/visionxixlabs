# Desktop governance and automation alignment

Approved direction: implement the six desktop areas discussed after the Cursor review. The public cockpit is accepted and must not be redesigned. Preserve its authoritative identity, subscription, usage, integration and policy services. Local preferences never establish tool authority.

## Delivery order
1. Desktop Settings navigation/search and real persisted interaction preferences; compact consistent layout. Test actual controls in the native candidate.
2. Agent workspace with reliable context, history, queue/cancel semantics and governed review; maintain fail-closed behavior when policy is unavailable.
3. Safe local coding/review/worktree lifecycle and Git operations with recovery and explicit approvals.
4. Governed customization lifecycle using real supported capabilities, shared with existing cockpit services.
5. Refresh shared account/access/usage state and verify plan/role changes end to end without inventing entitlements.
6. Native acceptance and signed distribution only after prerequisites and release checks pass.

## First increment
Search the existing Settings sections by labels and capabilities, with accessible navigation and an honest empty state. Add a native persisted Command/Ctrl+Enter submission preference, default false for existing installations, wired to chat including IME protection. Keep existing desktop preferences and service policy intact. Improve the Settings proportions without dropping any current section or operation. No production mutation, no cockpit UI changes, no broad policy grants.

## Acceptance
Test search/navigation, persistence failure handling, Enter vs modified Enter, Shift+Enter and IME composition, live preference updates, and old native preferences compatibility. Build frontend/native candidate and click controls in the local app. Shared service failures remain explicit blockers, not local overrides.

### Local customization and navigation increment

- Plugins & Skills now separates enabled, disabled and MCP views. Saved installation state remains service-authoritative. After an uncertain mutation, installation controls remain locked until a fresh catalog read; refreshes started during the mutation cannot establish its outcome.
- Microsoft Learn MCP uses a new paired-session desktop adapter to the existing fixed public documentation connector. Current membership and commercial access are checked by the shared resolver; API keys cannot access this adapter. Search requires the existing organization installation, bounded input/rate limits and required audit. Neither queries nor result content are included in audit detail. No cloud credentials or arbitrary MCP endpoints are accepted.
- Desktop results accept only credential-free HTTPS Microsoft Learn URLs. Unmount, workspace replacement and installation changes invalidate pending UI results. Installation lifecycle remains owner/admin-managed and does not grant Agent authority.
- A keyboard command menu (Command/Ctrl+Shift+P) searches only the seven current customer destinations and uses the same navigation callback as the sidebar. It cannot execute tools or bypass access checks. Existing Agent and repository views remain mounted to preserve their state.
- Service adapter remains local until an authorized, verified release. The official public MCP connection/search passed a separate live read-only acceptance test; that is not a production desktop-session acceptance result.
