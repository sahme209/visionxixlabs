#!/bin/sh
cd /private/tmp/axiom-pipeline-control-guide-20261104 || exit 90
exec /usr/bin/env -i PATH=/Users/samirahmed/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin HOME=/private/tmp/axiom-pipeline-control-guide-evidence TMPDIR=/private/tmp/axiom-pipeline-control-guide-evidence NODE_ENV=test /usr/bin/sandbox-exec -f /private/tmp/axiom-pipeline-control-guide-evidence/deny.sb /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node /private/tmp/axiom-pipeline-control-guide-evidence/binding-integrity.cjs
