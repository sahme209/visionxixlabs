'use strict';
// A single canonical external CJS module is the future main/consumer seam.
// No active launch identity exists until the REAL shared verifier + immutable
// pre-import launch profile is implemented and independently qualified here.
// Python file-set observations, JSON, ENV and imported callbacks are not proof.
const unavailable = Object.freeze({
  status: 'unavailable',
  reason: 'sealed_launch_not_implemented',
  executingIssuerIdentity: 'unavailable',
  runtimeQualification: 'unavailable',
  fleetQualification: 'unavailable',
  legacyQualification: 'unavailable',
  executionAuthorized: false,
});
function readIssuerIdentity() { return unavailable; }
module.exports = Object.freeze({ readIssuerIdentity });

if (require.main === module) {
  // Do not import Next, application hooks or a caller-selected entrypoint. A
  // manifest/hash check alone cannot qualify the currently missing sealed launch.
  // This real main entry refuses; there is deliberately no stub initializer.
  process.stderr.write('verified_issuer_launch_unavailable\n');
  process.exitCode = 1;
}
