# Selected-window focus recovery correction

Current evidence: native didResignActive revokes an idle selected session; the frontend focusLost handler also destroys selection. This explains why a user selection is absent after returning to chat, but does not establish the separate ordinary-text-area refusal cause.

User-approved boundary (October 30): keep only the selected window identity and its original finite lease on ordinary app switching. Erase snapshot pixels and any prepared input immediately. Withhold inputSelection while suspended. On Axiom foreground, require exact native owner/session/revision/window liveness revalidation before making selection usable. Do not extend selection or idle deadlines on revalidation. Capture and input preparation must require Axiom foreground at native dispatch and completion; capture in progress on blur is cancelled and cannot publish late pixels. Lock/screen sleep/user change/owner change/target termination/Stop/expiry continue to revoke all state.

No background capture, automatic capture, repeated input, new target permission or AI upload. Input confirmation and explicit foreground handoff remain separate and unchanged. One exact TextEdit before→after acceptance remains the only authorized live input test.

Validation planned: selected+observed blur clears pixels and suspends identity; capture and input unavailable while suspended; foreground revalidation restores only current unexpired exact metadata; changed/expired target revokes; blur during capture drops late image; native capture refuses background start/completion. Existing Stop, owner, lock and single-use guards remain.
