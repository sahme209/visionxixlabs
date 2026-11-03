# Exact6262effe build: failure preserved

The one offline production build of `6262effe4a12289647cff736bae815c805c78302` failed compilation. Owned exec92524 is terminal1; preparation and Prisma generation passed, but no full Next TypeScript, static-generation or output-verification pass is claimed. No second build or new5206/5207 preview was started. The older ae5aac78 rendering preview/apps remain unchanged.

Observed error: Next's MinifyPlugin catches a minifier error and tries to construct `_webpack.WebpackError`, which itself throws “is not a constructor.” Source/log inspection identifies that masking call at plugin line135/buildError; the original caught error and offending asset are not established by this log. Do not label the source UI or canonical code as its cause without concrete diagnosis. No dependency/plugin patch, minifier rerun, browser test or weakened build gate was performed.

The existing reviewed harness did use pinned offline/ignore-scripts npm materialization from its copied cache under kernel network denial. Root clarified that this existing step is authorized; “no npm” shorthand meant no new dependencies, registry fetch, lifecycle scripts or network. Exact npm outcome/source/archive and log hashes remain in receipt.json. Build failure is not issuer/runtime qualification, activation or completion.
