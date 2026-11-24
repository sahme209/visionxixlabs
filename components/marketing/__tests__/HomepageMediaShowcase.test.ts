// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolveHomepageMedia } from "@/lib/marketing/homepageMedia";

const fixture = vi.hoisted(() => ({
  title: "Review a deployment",
  version: "v0.1.24",
  platform: "macos",
  sourceCommit: "b".repeat(40),
  durationSeconds: 65,
  transcript: "The operator opens the recorded plan.",
}));
const files = vi.hoisted(() => ({ present: true }));
vi.mock("@/lib/marketing/homepage-media.json", () => ({ default: fixture }));
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return {
    ...original,
    statSync: (url: string) => url.includes("/public/media/workspace/")
      ? { isFile: () => true, size: files.present ? 10 : 0 }
      : original.statSync(url),
  };
});

import { HomepageMediaShowcase } from "../HomepageMediaShowcase";

describe("homepage release media", () => {
  const exists = () => true;

  it("binds a reviewed manifest to exact asset paths", () => {
    const media = resolveHomepageMedia(fixture, exists);
    expect(media).toMatchObject({
      version: "v0.1.24",
      platform: "macOS",
      duration: "1:05",
      poster: "/media/workspace/v0.1.24/macos/poster.webp",
      video: "/media/workspace/v0.1.24/macos/walkthrough.webm",
      captions: "/media/workspace/v0.1.24/macos/captions.vtt",
    });
  });

  it.each([
    null,
    { ...fixture, version: "../../public" },
    { ...fixture, platform: "toString" },
    { ...fixture, sourceCommit: "ambiguous-short-sha" },
    { ...fixture, durationSeconds: 0 },
    { ...fixture, transcript: " " },
  ])("keeps the fallback for absent or invalid review data", (manifest) => {
    expect(resolveHomepageMedia(manifest, exists)).toBeNull();
  });

  it.each(["poster.webp", "walkthrough.webm", "captions.vtt"])(
    "requires a verified %s file",
    (file) => {
      expect(resolveHomepageMedia(fixture, (url) => !url.endsWith(file))).toBeNull();
    },
  );

  it("renders user-controlled playback, version, captions and transcript", () => {
    const html = renderToStaticMarkup(createElement(HomepageMediaShowcase, { fallback: "Scripted tour" }));
    expect(html).toContain('preload="none"');
    expect(html).toContain(" controls");
    expect(html).toContain('kind="captions"');
    expect(html).toContain("Read transcript");
    expect(html).toContain(fixture.transcript);
    expect(html).toContain(fixture.version);
    expect(html).toContain(fixture.sourceCommit);
    expect(html).not.toMatch(/autoplay| loop/i);
  });

  it("shows the scripted content when an asset file is empty", () => {
    files.present = false;
    try {
      expect(renderToStaticMarkup(createElement(HomepageMediaShowcase, { fallback: "Scripted tour" }))).toBe("Scripted tour");
    } finally {
      files.present = true;
    }
  });

  it("announces a playback failure and leaves the transcript available", () => {
    const { container, unmount } = render(createElement(HomepageMediaShowcase, { fallback: "Scripted tour" }));
    try {
      const player = container.querySelector("video")!;
      const status = within(container).getByRole("status");
      const transcript = within(container).getByText("Read transcript");
      expect(status.textContent).toBe("");
      transcript.focus();
      fireEvent.error(player);
      expect(status.textContent).toContain("The video couldn’t play");
      expect(document.activeElement).toBe(transcript);
      expect(within(container).getByText(fixture.transcript)).toBeTruthy();
      fireEvent.playing(player);
      expect(status.textContent).toBe("");
    } finally {
      unmount();
    }
  });
});
