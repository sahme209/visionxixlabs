# Original minifier error recovered

Exact6262 source was copied to a fresh owned stage, with original source/dependencies untouched. Only the private minifier error wrapper’s three `new _webpack.WebpackError(` expressions became `new Error(`. Distinct inode, one link, contained plugin path and exact hashes/diff were checked. Actual minification stayed enabled, without debug asset dumping. No preview or qualification may use this patched stage.

The full-route compile now reports the original parser error and filenames: the canonical runtime assignment `process.env.NODE_ENV = 'production'` becomes invalid `"production" = 'production';` under Webpack’s production DefinePlugin replacement. Actual assets and full error are preserved in the diagnostic log/receipt. This confirms a source/compiler interaction rather than the new Security figure. The log ends “Build failed because of webpack errors.”

The outer driver exited1 additionally because the existing helper’s process-group probe/cleanup raised PermissionError after child completion. Fresh process inspection found no matching diagnostic compiler or Next worker, but this is not complete descendant-quiescence proof. No source fix, automatic further compile, identity initialization, provider action or passing-build claim followed.
