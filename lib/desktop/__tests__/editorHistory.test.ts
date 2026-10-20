import { expect, it } from "vitest";
import { newEditorHistory, editHistory, moveHistory } from "../../../desktop/src/lib/editorHistory";
it("undoes edits including indentation and clears redo on a new edit", () => {
  let state = newEditorHistory("original");
  state = editHistory(state, "edited"); state = editHistory(state, "  edited");
  state = moveHistory(state, "undo"); expect(state.present).toBe("edited");
  state = moveHistory(state, "redo"); expect(state.present).toBe("  edited");
  state = moveHistory(state, "undo"); state = editHistory(state, "replacement");
  expect(moveHistory(state, "redo").present).toBe("replacement");
});
it("does not record unchanged edits and bounds retained history", () => {
  let state = newEditorHistory("initial"); expect(editHistory(state, "initial")).toBe(state);
  for (let i = 0; i < 80; i++) state = editHistory(state, `${i}${"x".repeat(20000)}`);
  expect(state.past.length).toBeLessThanOrEqual(40);
  expect([...state.past, ...state.future].reduce((n, text) => n + text.length, 0)).toBeLessThanOrEqual(500000);
  expect(moveHistory(newEditorHistory("new file"), "undo").present).toBe("new file");
});
