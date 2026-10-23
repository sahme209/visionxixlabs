import{expect,it}from'vitest';import{isVerifiedIntegrationStatus}from'../../../desktop/src/lib/integrationStatusPresentation';
it.each(['Disconnected','Not connected','unverified','Validation overdue','Consent recorded','0 verified','Checking status'])('does not imply verified access for %s',state=>{expect(isVerifiedIntegrationStatus(state)).toBe(false);});
it.each(['active','Connected','Validated read-only','2 verified'])('recognizes explicitly verified status %s',state=>{expect(isVerifiedIntegrationStatus(state)).toBe(true);});
