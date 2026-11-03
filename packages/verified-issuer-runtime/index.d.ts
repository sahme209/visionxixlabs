export interface IssuerIdentityUnavailable {
  readonly status: 'unavailable';
  readonly reason: 'sealed_launch_not_implemented';
  readonly executingIssuerIdentity: 'unavailable';
  readonly runtimeQualification: 'unavailable';
  readonly fleetQualification: 'unavailable';
  readonly legacyQualification: 'unavailable';
  readonly executionAuthorized: false;
}
/** Read only. No initializer, digest argument, authority or verified variant. */
export function readIssuerIdentity(): Readonly<IssuerIdentityUnavailable>;
