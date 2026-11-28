// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DictationButton } from "../DictationButton";

class FakeRec {
  static last: FakeRec | null = null;
  continuous = false; interimResults = true; lang = "";
  onresult: ((e: unknown) => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(() => this.onend?.()); abort = vi.fn();
  constructor() { FakeRec.last = this; }
}

afterEach(() => { cleanup(); delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; FakeRec.last = null; });

describe("DictationButton", () => {
  it("is hidden without speech recognition", () => {
    render(createElement(DictationButton, { onPhrase: () => {} }));
    expect(screen.queryByRole("button", { name: /dictat/i })).toBeNull();
  });
  it("passes final phrases to the caller and never sends", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRec;
    const onPhrase = vi.fn();
    render(createElement(DictationButton, { onPhrase }));
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    const rec = FakeRec.last!;
    expect(rec.start).toHaveBeenCalled();
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(false);
    act(() => rec.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "ship it" }], { isFinal: true })] }));
    expect(onPhrase).toHaveBeenCalledWith("ship it");
    fireEvent.click(screen.getByRole("button", { name: "Stop dictation" }));
    expect(rec.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Dictate" })).toBeTruthy();
  });
  it("shows a plain message when the microphone is blocked", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRec;
    render(createElement(DictationButton, { onPhrase: () => {} }));
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    act(() => FakeRec.last!.onerror?.({ error: "not-allowed" }));
    expect(screen.getByRole("alert").textContent).toMatch(/Microphone access is off/);
  });
});
