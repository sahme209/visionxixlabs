# Targeted minifier diagnostic — not full-build acceptance

Exact source `6262effe4a12289647cff736bae815c805c78302`. One root-authorized diagnostic used a fresh copy of the failed stage excluding `.next`, unchanged cached dependencies, pinned Node, the existing clean dummy environment and kernel network denial. No install, framework patch, minification disablement, identity initialization or provider action.

The 180-second/64-MiB-bounded command selected `/security` and `/demo` with Next’s supported `--debug-build-paths`, `--experimental-build-mode compile` and `NEXT_DEBUG_MINIFY=1`. It exited **0** and captured 42 distinct minifier input assets in the private owned log. Both selected public routes compiled with minification enabled. This does **not** reproduce or explain the original full-build error, nor establish full Next types, generate/static output, runtime qualification or browser acceptance. No second run or new preview was started.

Read-only comparison found identical package/lock/config/type-config, Next minifier/webpack wrapper/SWC loader/native binding and pinned Node hashes between the earlier passing ae5 stage and failed626 stage. Thus no dependency/config drift was observed in those compared inputs. The original masked error/asset remains unconfirmed; neither the new visual nor canonical runtime source is blamed without evidence.

The original failed stage and receipt remain untouched. Exact command, input hashes, terminal result, log hash and asset names are in `receipt.json`; full generated asset text stays private in the owned root. Process accounting bounds only the original process group; no complete descendant-quiescence claim.
