'use strict';
// Isolated component entry only. This is not the canonical issuer or app consumer.
const path = require('node:path');
const addon = path.join(__dirname, 'origin-client.node');
if (require.main !== module || require.cache[__filename] !== module || require.cache[addon]) {
  throw new Error('origin_unit_fresh_main_required');
}
require(addon);
process.stdout.write('origin_component_observed; executingIssuerIdentity=unavailable\n');
