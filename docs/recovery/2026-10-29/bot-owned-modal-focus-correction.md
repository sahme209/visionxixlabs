# Owned native consent dialog focus correction

Observed October 30: selecting TextEdit and restoring Axiom via Finder Open plus its Computer tab revalidated the exact selected identity. Preparation displayed the authorized disposable-document NSAlert. Accepting it returned the panel to idle without an input proposal or edit.

The frontend subscribed to main-window focus. An owned NSAlert makes that window lose key focus while NSApplication remains active. Both observation and preparation cancelled on this signal. Native policy already uses NSApplication activation, and preserves its separate exact review, TextEdit foreground handoff, writability, owner/session, deadline and one-attempt checks.

The repair aligns metadata-only frontend focus with trusted NSApplication didBecomeActive/didResignActive notifications. It does not ignore application deactivation or skip consent. A main-only Rust command initializes a singleton native monitor, emitting only active/sequence to the main window. The listener is installed first, rejects stale/invalid events, and cleans up if initialization fails. Unsupported platforms fail closed. No background capture/input, permissions, capture pixels, provider writes, or production activation is added.

Three regression tests failed against the former window-focus implementation, then passed with the repair. Focus/input/observation panel suites: 21 checks passed. Desktop types/frontend build and native Swift/Rust build passed. Independent reviewer found no critical/important issues. Embedded build and actual-app acceptance remain separate: no live input success is claimed.
