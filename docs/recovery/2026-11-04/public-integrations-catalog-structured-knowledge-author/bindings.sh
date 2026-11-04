#!/bin/sh
cd /private/tmp/axiom-b4-public-catalog-20261104 || exit 90
exec /usr/bin/env -i PATH=/Users/samirahmed/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/private/tmp/axiom-b4-public-catalog-evidence TMPDIR=/private/tmp/axiom-b4-public-catalog-evidence NODE_ENV=test /usr/bin/sandbox-exec -f /private/tmp/axiom-b4-public-catalog-evidence/deny.sb /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node /private/tmp/axiom-b4-public-catalog-evidence/binding-integrity.cjs
