# ServiceNow evidence-readback gate

The existing restricted Change Management connection has no independently verified journal-read capability. Its server credential reports `journalRead:false`. The provider link executor correctly refuses BEFORE claim/mutation in that state. Reading an empty work_notes field is not proof that an append was persisted.

To perform live evidence linking, an administrator must approve a specific read-only journal capability for the existing dev316885 test instance. First inspect that instance's supported API/ACL configuration; then review the exact endpoint, permission scope, returned fields and account before creating or expanding any grant. Prefer a narrow existing endpoint. Do not silently enable general Table API or broad useraccount scopes, infer access from a successful unrelated read, change administrator roles, or create customer infrastructure.

Required semantics for an adapter: fixed HTTPS instance and exact existing change sys_id; read-only request; independently authorized current credential; bounded time/body/count; reject redirects; verify record identity, journal field, unique saved action marker and exact canonical work-note content; do not expose bodies/tokens to AI, logs or browser; return true only for the exact appended entry. Missing/ambiguous/empty data is unavailable/unknown, never success. A failed/unknown attempt is never resent.

Local code/mock testing does not authorize installing the endpoint, expanding OAuth grants, activating production, or sending a work note. Those remain separate exact approvals after the supported instance configuration is known. Existing KAN-4/CHG0030002 and original unknown/recovery history must remain intact.
