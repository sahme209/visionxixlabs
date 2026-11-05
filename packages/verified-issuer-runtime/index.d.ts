export interface IssuerIdentityUnavailable {
  readonly status: 'unavailable';
  readonly reason: 'sealed_launch_not_implemented' | 'canonical_consumer_qualification_pending';
  /** Actual package/origin observations only; never an issuer or action grant. */
  readonly packageFileSetObservationDigest?: string;
  readonly nativeOriginObservation?: 'observed';
  readonly executingIssuerIdentity: 'unavailable';
  readonly runtimeQualification: 'unavailable';
  readonly fleetQualification: 'unavailable';
  readonly legacyQualification: 'unavailable';
  readonly executionAuthorized: false;
}
/** Live artifact identity only; no runtime qualification or action grant. */
export interface IssuerIdentityCurrent {
  readonly status: 'current';
  readonly issuerArtifactDigest: string;
  readonly executingIssuerIdentity: 'current';
  readonly runtimeQualification: 'unavailable';
  readonly fleetQualification: 'unavailable';
  readonly legacyQualification: 'unavailable';
  readonly executionAuthorized: false;
}
export type IssuerIdentity = IssuerIdentityUnavailable | IssuerIdentityCurrent;
/** Read only. Only the protected canonical main can initialize lexical state. */
export function readIssuerIdentity(): Readonly<IssuerIdentity>;
