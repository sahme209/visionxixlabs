import {expect, it} from "vitest";
import {editorMatches} from "../../../desktop/src/lib/editorSearch";
it("matches exact literal text and bounds match enumeration", () => {
  expect(editorMatches(".* a .*", ".*").offsets).toEqual([0, 5]);
  expect(editorMatches("Alpha alpha", "alpha").offsets).toEqual([6]);
  expect(editorMatches("😀😀", "😀").offsets).toEqual([0, 2]);
  expect(editorMatches("x".repeat(2000), "x")).toMatchObject({limited: true});
  expect(editorMatches("x".repeat(2000), "x").offsets).toHaveLength(1000);
  expect(editorMatches("abc", "").offsets).toEqual([]);
  expect(editorMatches("x".repeat(300), "x".repeat(257)).offsets).toEqual([]);
});
it("replaces only a validated literal occurrence without replacement-string expansion", async () => {
  const {replaceEditorMatch} = await import("../../../desktop/src/lib/editorSearch");
  expect(replaceEditorMatch("a a", "a", "$&", 2)).toBe("a $&");
  expect(replaceEditorMatch("😀😀", "😀", "", 2)).toBe("😀");
  expect(replaceEditorMatch("abc", "b", "x", 0)).toBeNull();
  expect(replaceEditorMatch("abc", "", "x", 0)).toBeNull();
  expect(replaceEditorMatch("abc", "a", "x".repeat(8001), 0)).toBeNull();
  expect(replaceEditorMatch("x".repeat(999999), "x", "😀", 0)).toBeNull();
});
