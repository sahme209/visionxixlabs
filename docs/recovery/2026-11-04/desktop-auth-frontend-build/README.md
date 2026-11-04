# Isolated desktop frontend compile after auth repair

Canonical desktop Vite6.4.2 (declared^6.0.0) compiled the exact current tracked source successfully from the desktop package working directory. Assets/index were written only into the owned temporary output; every local index reference exists and all emitted files are hashed in output-manifest.json. Environment was scrubbed with a private empty envDir, network denied and writes outside the owned directory denied. No source or dependency was changed.

The first invocation used the repository-level transitive Vite8 and repository working directory; Tailwind selected the wrong palette and failed on bg-axiom-surface. That command is a preserved noncanonical diagnostic, not a product defect or passing build. The corrected command uses the project's desktop tool/cwd, without changing CSS, installing dependencies, updating Browserslist or bypassing restrictions.

Large-chunk and mixed dynamic/static-import warnings remain open performance considerations; compile does not measure startup. This was Vite frontend compilation only: the release/version script, previously passing types/tests, native Rust/signing, installer build/publication and actual browser/native/account/secure-vault/provider acceptance were not run or implied. Signed paired apps and drafts remain untouched; no preview process was launched.
