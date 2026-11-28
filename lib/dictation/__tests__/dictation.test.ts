import { describe, expect, it } from "vitest";
import { appendTranscript, dictationErrorMessage, finalPhrases, recognitionConstructor } from "../dictation";

describe("dictation", () => {
  it("appends phrases with one space and trims", () => {
    expect(appendTranscript("", "  deploy   to staging ")).toBe("deploy to staging");
    expect(appendTranscript("check", "readiness")).toBe("check readiness");
    expect(appendTranscript("check ", "readiness")).toBe("check readiness");
    expect(appendTranscript("same", "   ")).toBe("same");
    expect(appendTranscript("a", "b".repeat(20), 10)).toHaveLength(10);
  });
  it("keeps only final results", () => {
    const r = (t: string, isFinal: boolean) => Object.assign([{ transcript: t }], { isFinal });
    expect(finalPhrases({ resultIndex: 1, results: [r("old", true), r("interim", false), r("new", true)] })).toEqual(["new"]);
  });
  it("finds the constructor only where it exists", () => {
    function Rec() {}
    expect(recognitionConstructor({})).toBeNull();
    expect(recognitionConstructor(undefined)).toBeNull();
    expect(recognitionConstructor({ webkitSpeechRecognition: Rec })).toBe(Rec);
    expect(recognitionConstructor({ SpeechRecognition: Rec, webkitSpeechRecognition: () => 0 })).toBe(Rec);
  });
  it("maps errors to plain messages", () => {
    expect(dictationErrorMessage("not-allowed").kind).toBe("denied");
    expect(dictationErrorMessage("network").message).toMatch(/system dictation/);
    expect(dictationErrorMessage("weird").kind).toBe("unavailable");
  });
});
