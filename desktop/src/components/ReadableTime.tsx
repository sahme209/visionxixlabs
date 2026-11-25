export function ReadableTime({dateTime, fullText, displayText}: {
  dateTime: string;
  fullText: string;
  displayText: string;
}) {
  return <time dateTime={dateTime}>
    {displayText === fullText ? fullText : <>
      <span aria-hidden="true" title={fullText}>{displayText}</span>
      <span className="sr-only">{fullText}</span>
    </>}
  </time>;
}
