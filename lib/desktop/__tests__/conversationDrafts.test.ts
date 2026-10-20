import {expect, it} from "vitest";
import {rememberConversationDraft} from "../../../desktop/src/lib/conversationDrafts";
it("preserves distinct drafts immutably and removes cleared prompts", () => {
  const old = new Map([["one", "first"]]);
  const next = rememberConversationDraft(old, "two", "second")!;
  expect([...old]).toEqual([["one", "first"]]);
  expect([...next]).toEqual([["one", "first"], ["two", "second"]]);
  expect(rememberConversationDraft(next, "one", "")!.has("one")).toBe(false);
});
it("refuses capacity overflow without evicting earlier work", () => {
  const full = new Map(Array.from({length: 20}, (_, i) => [`${i}`, "draft"]));
  expect(rememberConversationDraft(full, "new", "draft")).toBeNull();
  expect(rememberConversationDraft(full, "0", "updated")!.get("0")).toBe("updated");
  expect(rememberConversationDraft(new Map(), "large", "x".repeat(500001))).toBeNull();
  expect(full.size).toBe(20);
});
