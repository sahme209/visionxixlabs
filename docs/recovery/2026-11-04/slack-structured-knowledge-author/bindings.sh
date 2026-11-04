#!/bin/sh
cd /private/tmp/axiom-b4-slack-20261104 || exit 90
exec /usr/bin/env -i PATH=/Users/samirahmed/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/private/tmp/axiom-b4-slack-evidence TMPDIR=/private/tmp/axiom-b4-slack-evidence NODE_ENV=test /usr/bin/sandbox-exec -f /private/tmp/axiom-b4-slack-evidence/deny.sb /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node /private/tmp/axiom-b4-slack-evidence/binding-integrity.cjs
