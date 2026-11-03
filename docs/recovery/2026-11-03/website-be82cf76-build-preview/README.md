# Exact be82 website build and safe local preview

The one unmodified offline full production build exited0: optimized compilation, Next TypeScript/static generation and output verification passed. Framework dependencies were unpatched; the canonical source fix resolved the prior invalid assignment. Status remains `build_outputs_observed_unqualified`, executionAuthorized=false: this is not native/runtime/fleet qualification.

Fresh preview5206/5207 uses the existing network-outbound-denied/read-only backend and strict public-read proxy. `/security` and `/demo` return200 with exact source header/no cookie; auth API and POST return403. All14 referenced Security JS/CSS assets match built bytes. Old5204 remains running. Dummy private environment is fixed; no runtime-loaded `.env` file exists (only tracked `.env.example`; an initial overbroad glob check flagged that harmless example before the precise check passed).

Security’s new original static Bot prompt/response figure is present in returned HTML. The local uncompressed byte comparison is recorded, not a browser performance/Core Web Vitals measurement. Browser visual/keyboard/screenshot acceptance is not claimed. Root may open the URL through supported preview tooling; no identity/provider action or deployment occurred.
