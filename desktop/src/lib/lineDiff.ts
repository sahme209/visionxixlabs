export interface DiffLine {
  kind: "context" | "add" | "remove" | "omitted";
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

function splitLines(value: string): string[] {
  return value === "" ? [] : value.split("\n");
}

/** Line-oriented LCS diff, bounded so an unusually large file cannot stall the UI. */
export function createLineDiff(before: string, after: string): DiffLine[] {
  const oldLines = splitLines(before);
  const newLines = splitLines(after);
  if (oldLines.length * newLines.length > 300_000) return coarseDiff(oldLines, newLines);

  const width = newLines.length + 1;
  const table = new Uint32Array((oldLines.length + 1) * width);
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      const position = oldIndex * width + newIndex;
      table[position] = oldLines[oldIndex] === newLines[newIndex]
        ? table[(oldIndex + 1) * width + newIndex + 1] + 1
        : Math.max(table[(oldIndex + 1) * width + newIndex], table[oldIndex * width + newIndex + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex < oldLines.length && newIndex < newLines.length && oldLines[oldIndex] === newLines[newIndex]) {
      lines.push({ kind: "context", text: oldLines[oldIndex], oldLine: oldIndex + 1, newLine: newIndex + 1 });
      oldIndex += 1;
      newIndex += 1;
    } else if (newIndex < newLines.length && (oldIndex === oldLines.length || table[oldIndex * width + newIndex + 1] >= table[(oldIndex + 1) * width + newIndex])) {
      lines.push({ kind: "add", text: newLines[newIndex], oldLine: null, newLine: newIndex + 1 });
      newIndex += 1;
    } else {
      lines.push({ kind: "remove", text: oldLines[oldIndex], oldLine: oldIndex + 1, newLine: null });
      oldIndex += 1;
    }
  }
  return compactContext(lines);
}

function coarseDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < oldLines.length - prefix && suffix < newLines.length - prefix && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]) suffix += 1;
  const lines: DiffLine[] = [];
  oldLines.slice(0, prefix).forEach((text, index) => lines.push({ kind: "context", text, oldLine: index + 1, newLine: index + 1 }));
  oldLines.slice(prefix, oldLines.length - suffix).forEach((text, index) => lines.push({ kind: "remove", text, oldLine: prefix + index + 1, newLine: null }));
  newLines.slice(prefix, newLines.length - suffix).forEach((text, index) => lines.push({ kind: "add", text, oldLine: null, newLine: prefix + index + 1 }));
  for (let index = 0; index < suffix; index += 1) {
    lines.push({ kind: "context", text: oldLines[oldLines.length - suffix + index], oldLine: oldLines.length - suffix + index + 1, newLine: newLines.length - suffix + index + 1 });
  }
  return compactContext(lines);
}

function compactContext(lines: DiffLine[]): DiffLine[] {
  const visible = new Set<number>();
  lines.forEach((line, index) => {
    if (line.kind === "context") return;
    for (let nearby = Math.max(0, index - 3); nearby <= Math.min(lines.length - 1, index + 3); nearby += 1) visible.add(nearby);
  });
  const compacted: DiffLine[] = [];
  let omitted = false;
  lines.forEach((line, index) => {
    if (visible.has(index)) {
      compacted.push(line);
      omitted = false;
    } else if (!omitted) {
      compacted.push({ kind: "omitted", text: "… unchanged lines …", oldLine: null, newLine: null });
      omitted = true;
    }
  });
  return compacted;
}
