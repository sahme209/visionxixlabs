# Canonical production-mode compiler correction

Remove the redundant runtime write to `process.env.NODE_ENV`, and require its fixed production value at `cleanLoader` before canonical initialization. The reviewed bootstrap already supplies that value. No Reflect setter, framework patch, disabled DefinePlugin/minifier or authority widening.

The regression compiles the actual canonical source with installed Next Webpack’s real DefinePlugin, then passes emitted module bytes to the actual Next SWC minifier. It never executes the bundle/native runtime. The final original-source RED reproduces the exact invalid literal assignment; the corrected source GREEN passes. Two earlier harness misconfigurations (missing standalone webpack dependency, then accidentally externalized entry) are preserved and do not count as semantic RED. Dependencies resolve from the already verified offline cached stage; kernel networking is denied.

The existing three CJS test files ran once after the change: 29 tests passed, not merely the eight originally estimated. No NAPI matrix, blocked security test, full Next build, service/profile/image, runtime identity or production qualification ran. Parent review and one subsequent unmodified full build remain separate.
