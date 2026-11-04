#!/bin/sh
cd /private/tmp/axiom-b5-offline-20261104 || exit 90
exec /usr/bin/env -i PATH=/Users/samirahmed/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/private/tmp/axiom-b5-offline-evidence TMPDIR=/private/tmp/axiom-b5-offline-evidence/fixtures NODE_ENV=test NODE_COMPILE_CACHE=/private/tmp/axiom-b5-offline-evidence/node-cache /usr/bin/sandbox-exec -f /private/tmp/axiom-b5-offline-evidence/deny.sb /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node /private/tmp/axiom-b5-offline-evidence/diagnostic/read-boundary.cjs
