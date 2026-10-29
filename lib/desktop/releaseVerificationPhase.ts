export type ReleaseVerificationPhase = 'authority'|'source'|'policy'|'workflow';
export class ReleaseVerificationFailure extends Error {
  readonly code: string;
  constructor(readonly phase: ReleaseVerificationPhase, immutableRequired=false) {
    super('Release verification could not be established.');
    this.code=immutableRequired?'release_immutable_required':`release_review_${phase}_unavailable`;
  }
}
/** Only bounded public phase codes leave the server; underlying errors stay private. */
export async function inReleaseVerificationPhase<T>(phase:ReleaseVerificationPhase,work:()=>Promise<T>):Promise<T>{
  try{return await work()}catch(error){if(error instanceof ReleaseVerificationFailure)throw error;throw new ReleaseVerificationFailure(phase)}
}
