'use strict';
// Current-process/file observations ONLY. None establishes pre-import controls,
// backing-image protection, sandbox qualification, or executing issuer identity.
const fs = require('node:fs');
const path = require('node:path');
const { verifyPackageFiles } = require('./verify-package.cjs');
function inspectLaunchControls(inputRoot) {
  const unavailable = {qualification:'launch_controls_incomplete', reason:'package_verification_failed', packageFileSetVerified:false, executingIssuerIdentity:'unavailable', executionAuthorized:false};
  try { verifyPackageFiles(inputRoot); } catch { return Object.freeze(unavailable); }
  const observed = {
    qualification: 'launch_controls_incomplete',
    reason: 'controls_observed_incomplete',
    packageFileSetVerified: true,
    readonlyManifestOpen: 'not_kernel_erofs',
    runtimeProfileMatches: process.platform === 'darwin' && process.arch === 'arm64' && process.version === 'v24.21.0',
    executableMatchesPackagedNode: false,
    canonicalModuleInsideRoot: false,
    currentLoaderOverrides: process.execArgv.length || Object.entries(process.env).some(([key, value]) => value && (key === 'NODE_OPTIONS' || key === 'NODE_PATH' || key.startsWith('DYLD_'))) ? 'present' : 'none_observed',
    preImportControls: 'unavailable',
    sandboxQualification: 'unavailable',
    executingIssuerIdentity: 'unavailable',
    runtimeQualification: 'unavailable',
    fleetQualification: 'unavailable',
    legacyQualification: 'unavailable',
    executionAuthorized: false,
  };
  try {
    const root = fs.realpathSync(inputRoot);
    const packagedNode = path.join(root, '__axiom_runtime__/node');
    observed.executableMatchesPackagedNode = fs.realpathSync(process.execPath) === packagedNode && fs.realpathSync(packagedNode) === packagedNode;
    const canonicalModule = path.join(root, 'node_modules/@axiom/verified-issuer-runtime/internal/inspect-launch-controls.cjs');
    try {
      const target = fs.realpathSync(canonicalModule);
      const relativeTarget = path.relative(root, target);
      observed.canonicalModuleInsideRoot = relativeTarget !== '' && relativeTarget !== '..' && !relativeTarget.startsWith('..'+path.sep) && !path.isAbsolute(relativeTarget) && fs.realpathSync(__filename) === target && __filename === target;
    } catch {}
    // No creation/truncation/write: successful O_WRONLY open is NOT readonly.
    // EACCES/EPERM can reflect permissions and do not establish kernel EROFS.
    let fd;
    try {
      fd = fs.openSync(path.join(root, '_axiom_local_issuer_manifest.json'), fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW);
    } catch (error) {
      if (error && error.code === 'EROFS') observed.readonlyManifestOpen = 'kernel_erofs';
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  } catch {
    // Fixed observations disclose no paths, environment values, or exceptions.
  }
  return Object.freeze(observed);
}
module.exports = Object.freeze({ inspectLaunchControls });
