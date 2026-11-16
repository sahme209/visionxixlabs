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

/** Dependency-free contract for this literal workflow subset, not a YAML parser.
 * Reject unsupported trigger forms rather than allowing comments to confer authority. */
export function desktopReleaseWorkflowErrors(source) {
  const fail = () => ["desktop release workflow must be manual-only with early exact event/tag-ref checks"];
  if (typeof source !== "string") return fail();
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const on = lines.map((line, i) => /^(?:on|"on"|'on')\s*:/.test(line) ? i : -1).filter(i => i >= 0);
  if (on.length !== 1 || lines[on[0]] !== "on:") return fail();
  let end = on[0] + 1;
  while (end < lines.length && (!lines[end].trim() || /^\s/.test(lines[end]) || /^#/.test(lines[end]))) end++;
  const trigger = lines.slice(on[0] + 1, end).filter(line => line.trim() && !/^\s*#/.test(line));
  if (trigger.some(line => /\t|(?:^|[\s{,])[&*][A-Za-z0-9_-]|^\s*<<\s*:/.test(line))) return fail();
  const events = trigger.filter(line => /^  \S/.test(line));
  if (events.length !== 1 || events[0] !== "  workflow_dispatch:" || trigger.some(line => !/^ {2,}\S/.test(line))) return fail();
  const jobs = lines.map((line, i) => /^  (?:validate-release|"validate-release"|'validate-release')\s*:/.test(line) ? i : -1).filter(i => i >= 0);
  if (jobs.length !== 1 || lines[jobs[0]] !== "  validate-release:") return fail();
  let jobEnd = jobs[0] + 1;
  while (jobEnd < lines.length && !/^  \S/.test(lines[jobEnd])) jobEnd++;
  const starts = lines.map((line, i) => line === "      - name: Match tag to the desktop package version" ? i : -1).filter(i => i >= 0);
  if (starts.length !== 1 || starts[0] <= jobs[0] || starts[0] >= jobEnd) return fail();
  let stop = starts[0] + 1;
  while (stop < lines.length && !/^      - |^  [A-Za-z]/.test(lines[stop])) stop++;
  const step = lines.slice(starts[0] + 1, stop);
  const env = step.indexOf("        env:"), run = step.indexOf("        run: |");
  if (env < 0 || run <= env || step.filter(line => line === "        env:").length !== 1 || step.filter(line => line === "        run: |").length !== 1) return fail();
  const environment = step.slice(env + 1, run);
  for (const [name, expression] of [["RELEASE_EVENT", "${{ github.event_name }}"], ["RELEASE_REF", "${{ github.ref }}"]]) {
    const bindings = environment.filter(line => new RegExp("^          " + name + "\\s*:").test(line));
    if (bindings.length !== 1 || bindings[0] !== "          " + name + ": " + expression) return fail();
  }
  const commands = step.slice(run + 1).filter(line => line.trim() && !/^\s*#/.test(line));
  if (commands[0] !== "          test \"$RELEASE_EVENT\" = workflow_dispatch || { echo 'Only a manual release dispatch is supported.' >&2; exit 1; }" || commands[1] !== "          test \"$RELEASE_REF\" = \"refs/tags/$REQUESTED_TAG\" || { echo 'Select the exact requested release tag before starting.' >&2; exit 1; }" || commands[2] !== "          npm --prefix desktop ci --ignore-scripts" || commands[3] !== "          node scripts/check-desktop-release.mjs") return fail();
  return [];
}
