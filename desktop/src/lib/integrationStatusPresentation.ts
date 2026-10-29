/** Presentation only: status text never grants connection authority. */
export function isVerifiedIntegrationStatus(status: string): boolean {
  return /^(?:active|connected|verified|validated[ _-]read[ _-]only|[1-9]\d* verified)$/i.test(status.trim());
}
