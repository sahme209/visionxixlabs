import { z } from "zod";

const recordedWindowInstant = z.string().datetime({offset: true});
const recordedWindowTime = new Intl.DateTimeFormat(undefined, {
  year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  timeZone: "UTC", timeZoneName: "short",
});

export function RecordedUtcTime({value}: {value: number | string | null | undefined}) {
  if (typeof value !== "number" && !recordedWindowInstant.safeParse(value).success) return <>Unavailable</>;
  if (value == null) return <>Unavailable</>;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return <>Unavailable</>;
  return <time dateTime={instant.toISOString()}>{recordedWindowTime.format(instant)}</time>;
}

export function RecordedReleaseWindow({window}: {window: {startUtc: string; endUtc: string} | null | undefined}) {
  if (!window || !recordedWindowInstant.safeParse(window.startUtc).success ||
    !recordedWindowInstant.safeParse(window.endUtc).success) return <>Unavailable</>;
  const start = Date.parse(window.startUtc);
  const end = Date.parse(window.endUtc);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return <>Unavailable</>;
  return <>
    <time dateTime={new Date(start).toISOString()}>{recordedWindowTime.format(start)}</time>
    {" – "}
    <time dateTime={new Date(end).toISOString()}>{recordedWindowTime.format(end)}</time>
  </>;
}
