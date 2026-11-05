# Agent precommit connection ownership — local repair

Actual AgentChatView rendered tests reproduced three calls through a replaced mocked client config before notification: Send, approval and rejection. This is a client stale-handler problem, not proof of a server authorization bypass. Three entry guards compare the rendered transport context to current config before submit/queue mutation, send setup, or decision mutation/API call. Existing post-await ownership and approval/execution separation remain unchanged.

Initial three RED cases became six GREEN cases including same-context Send/approve/reject positive controls. A first edit script failed before writing; its inadvertently repeated GREEN-labelled run still failed all3 and is preserved, not claimed passing. Corrected final6tests and desktop source noEmit pass. Independent read-only review /root/adapter_probe_review found no important findings.

All transport/credentials are mocked; no real AI/provider/server/native request. Running983 app and session unchanged; source repair is unshipped. Complete mounted App/account transition, server authorization, all other handlers and full Governance remain separate acceptance requirements. Historical chat wording mentioning another repository was normal saved history and was not changed.
