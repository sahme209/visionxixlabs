# Historical consumed-parent journal proof UI

Live association 6bd02676 was independently approved at version 1. Loading parent b38 under this association is correctly refused by selected(), which binds ordinary action reads to the original association. list() likewise filters current association. The only proof button previously required such an action to be loaded, making cross-association recovery unreachable.

The local panel now offers explicit historical consumed-note ID/version fields and calls the existing fixed check_servicenow_journal endpoint. The endpoint still validates current approved association, requester/executor, definitely refused/unwritten parent, exact logical note, unchanged parent and current access. No action is loaded under a different authority; no backend policy changes. The existing short-lived absence receipt and separate fresh-child preparation/review remain mandatory. Exact-note presence blocks preparation. This is not a provider write or automatic retry.

11 focused panel checks, desktop TypeScript and frontend build passed. Live proof and updated signed native acceptance remain pending. The consumed parent was not changed.
