# Canonical Axiom mark

Source: the user's Screenshot 2026-10-24 at 10.00.28.png, supplied October 30, 2026. The white triangular mark is the approved replacement for the old purple/cyan logo.

Run `node scripts/generate-axiom-brand.mjs` from the repository root. The SVG uses the original pixels as a luminance mask; a 50% cutoff removes dark screenshot noise, preserving the original silhouette without an AI redraw. White is opaque, black is transparent. Exports are shared by web and desktop. Run `npm run tauri --prefix desktop -- icon src-tauri/icons/icon.png` for platform icon containers/derivatives.

Generated image-editing attempts were rejected for contour artifacts and are not referenced by this project. Published immutable installers must not be overwritten; the next installer release must use a fresh version and existing publication approval gates.
