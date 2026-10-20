/** In-memory, single-file history. Never persists content or changes the save baseline. */
export interface EditorHistory { past: string[]; present: string; future: string[] }
export function newEditorHistory(present: string): EditorHistory { return { past: [], present, future: [] }; }
function bounded(state: EditorHistory): EditorHistory {
  const past = state.past.slice(-40), future = state.future.slice(-40);
  let retained = [...past, ...future].reduce((total, text) => total + text.length, 0);
  while (retained > 500000 && (past.length || future.length)) {
    const discarded = past.length ? past.shift()! : future.shift()!;
    retained -= discarded.length;
  }
  return { past, present: state.present, future };
}
export function editHistory(state: EditorHistory, next: string): EditorHistory {
  return next === state.present ? state : bounded({past: [...state.past, state.present], present: next, future: []});
}
export function moveHistory(state: EditorHistory, direction: "undo" | "redo"): EditorHistory {
  const source = direction === "undo" ? state.past : state.future;
  if (!source.length) return state;
  return bounded(direction === "undo"
    ? {past: source.slice(0, -1), present: source[source.length - 1], future: [...state.future, state.present]}
    : {past: [...state.past, state.present], present: source[source.length - 1], future: source.slice(0, -1)});
}
