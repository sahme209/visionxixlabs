/** Read only literal identity fields from exact TOML package tables. Unsupported
 * workspace/escaped forms fail closed; dependencies are never version authority. */
function packageTables(text, arrayTable) {
  const tables = [];
  let current;
  const expected = arrayTable ? "[[package]]" : "[package]";
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      current = undefined;
      if (trimmed.replace(/\s*#.*$/, "").trim() === expected) {
        current = { invalid: false };
        tables.push(current);
      }
      continue;
    }
    if (!current) continue;
    const field = /^\s*(name|version|source)\s*=/.exec(line)?.[1];
    if (!field) continue;
    const literal = /^\s*(?:name|version|source)\s*=\s*(?:"([^"\\]*)"|'([^']*)')\s*(?:#.*)?$/.exec(line);
    if (!literal || Object.hasOwn(current, field)) current.invalid = true;
    else current[field] = literal[1] ?? literal[2];
  }
  return tables;
}

const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function desktopVersionAlignmentErrors({ desktopPackage, desktopLock, tauriConfig, cargoManifest, cargoLock }) {
  const errors = [];
  const expected = desktopPackage?.version;
  if (typeof expected !== "string" || !VERSION.test(expected)) errors.push("desktop/package.json must declare a literal release version");
  const check = (label, version) => {
    if (typeof version !== "string" || !VERSION.test(version) || version !== expected) errors.push(`${label} version does not match desktop/package.json version ${expected ?? "(missing)"}`);
  };
  check("tauri.conf.json", tauriConfig?.version);
  check("desktop/package-lock.json", desktopLock?.version);
  check("desktop/package-lock.json root package", desktopLock?.packages?.[""]?.version);
  if (desktopLock?.name !== "axiom-desktop" || desktopLock?.packages?.[""]?.name !== "axiom-desktop") errors.push("desktop/package-lock.json must identify the axiom-desktop root package");
  const manifestPackages = packageTables(cargoManifest, false);
  if (manifestPackages.length !== 1 || manifestPackages[0].invalid || manifestPackages[0].name !== "axiom-desktop") errors.push("Cargo.toml must contain exactly one literal axiom-desktop [package] identity");
  else check("Cargo.toml [package]", manifestPackages[0].version);
  const lockPackages = packageTables(cargoLock, true).filter(entry => entry.name === "axiom-desktop");
  if (lockPackages.length !== 1 || lockPackages[0].invalid || lockPackages[0].source !== undefined) errors.push("Cargo.lock must contain exactly one local axiom-desktop [[package]] identity");
  else check("Cargo.lock axiom-desktop package", lockPackages[0].version);
  return errors;
}
