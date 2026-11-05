# Conversation-control ownership — local repair

Two actual rendered failures reproduced New chat creation and saved-conversation reads under replacement mocked config before notification. Entry guards now refuse before draft/state/API mutation. Four targeted cases pass (two stale, two same-context); six prior Send/review tests were deliberately unselected, not rerun or claimed newly passing. Desktop source types pass. Independent source review found no important finding in this two-guard scope.

No real credential/provider/AI/native/server activity. Running983 app unchanged. This is not an exhaustive handler or account-transition acceptance. Review identified a separate candidate in ConversationRename.run: it captures current config at invocation without rendered-context check. That still needs its own reproduction/repair; do not claim it fixed here. All21parent requirements, Governance trust gate and genuine human decisions remain open.
