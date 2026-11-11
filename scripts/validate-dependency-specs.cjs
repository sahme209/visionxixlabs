'use strict';
// Registry-only exact versions. The single alias preserves the reviewed compiler
// API while the TypeScript 7 native checker is introduced alongside it.
function validatePackageSpecs(input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 4096) return false;
  const specs = input.trim().split(/\s+/);
  if (specs.length > 32) return false;
  const exact = /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+@[0-9][0-9A-Za-z.+-]*$/;
  const nativeAlias = /^@typescript\/native@npm:typescript@[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
  return specs.every(spec => exact.test(spec) || nativeAlias.test(spec));
}
module.exports = { validatePackageSpecs };
if (require.main === module && !validatePackageSpecs(process.env.PACKAGES)) {
  console.error('refused: invalid exact dependency specifications');
  process.exitCode = 1;
}
