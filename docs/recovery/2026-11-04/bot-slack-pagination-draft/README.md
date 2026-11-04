# Slack channel pagination preserves the unsent composer — local only

Previously every successful channel-page read cleared the selected target, unmounting the real Slack composer and losing unsaved message text. More-page success now retains at most one selected target beside the current bounded server page, only across exact same workspaceId and connectionVersion. Fresh duplicate details supersede the retained row; a nonmember or changed boundary clears selection. Explicit full refresh keeps its existing reset semantics. No accumulated pages or extra automatic reads are introduced.

The React composer key includes workspace, connection version and channel. Explicit deselection during a pending read is not resurrected. Failed-page responses preserve the existing composer as before; server current access and independent action approval remain separate and unchanged. Client selection or saved history grants no sending authority.

Actual initial9-case RED2failed/7passed reproduced text loss using the real SlackNotificationPanel. Final12-case focused file adds current100-page+1selection bound, pending deselection and failed-page preservation; all12pass. Fixtures mock service methods and non-Slack unrelated panel only. No provider mutation/request ID was created. Full desktop TypeScript for current source passes; independent review found no important issues. Root checked runtime diff, current source/test hashes and existing100-row DTO cap.

No actual Slack/provider/DB/native action, genuine independent approval, session/installer/native acceptance, full build or production deployment occurred. This is a bounded local usability fix. Existing written ServiceNow unknown attempt and all approval/uncertainty/spending restrictions remain unchanged.
