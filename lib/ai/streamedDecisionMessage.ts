/** Display-only preview of the first top-level JSON message string. Never
 * parses tool arguments or provides execution/approval authority. */
export function streamedDecisionMessage(source: string): string {
  if (!source.trimStart().startsWith("{")) return "";
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") depth--;
    else if (char === '"') {
      const start = i++;
      for (; i < source.length; i++) {
        if (source[i] === "\\") i++;
        else if (source[i] === '"') break;
      }
      if (i >= source.length) return "";
      if (depth !== 1) continue;
      let key: unknown;
      try { key = JSON.parse(source.slice(start, i + 1)); } catch { return ""; }
      let cursor = i + 1;
      while (/\s/.test(source[cursor] ?? "") && cursor < source.length) cursor++;
      if (key !== "message" || source[cursor] !== ":") continue;
      cursor++;
      while (/\s/.test(source[cursor] ?? "") && cursor < source.length) cursor++;
      if (source[cursor] !== '"') return "";
      const valueStart = ++cursor;
      for (; cursor < source.length; cursor++) {
        if (source[cursor] === '"') break;
        if (source[cursor] === "\\") {
          const escapeStart = cursor;
          cursor++;
          if (cursor >= source.length) { cursor = escapeStart; break; }
          if (source[cursor] === "u") {
            if (cursor + 4 >= source.length) { cursor = escapeStart; break; }
            cursor += 4;
          }
        }
      }
      try {
        const decoded = JSON.parse('"' + source.slice(valueStart, cursor) + '"') as string;
        // Do not emit half a surrogate pair across separate UTF-8 frames.
        const last = decoded.charCodeAt(decoded.length - 1);
        return last >= 0xd800 && last <= 0xdbff ? decoded.slice(0, -1) : decoded;
      }
      catch { return ""; }
    }
    if (depth < 0) return "";
  }
  return "";
}

/** Stream/network uncertainty cannot grant an automatic paid repair call. */
export class AgentStreamInterrupted extends Error {
  constructor() { super("agent_stream_interrupted"); this.name = "AgentStreamInterrupted"; }
}
