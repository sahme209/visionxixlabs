# Shared audit failure diagnostic privacy
1. A7 existing helper privacy repair; master/currentboard and prior5route evidence reconciled.
2. Actualhelper catches databasefailure but logs raw exceptionobject; not an escapingexception defect.
3. Change only catch diagnostic payload to fixedcode; preserve actualwriteargs/swallow/no-retry behavior.
4. Actualhelper tests with onlyprisma externalwrite mocked: arbitraryError/structuredobject andsuccess controls.
5. RED must show rawobject reaches console; no realdatabase/audit write/network/provider.
6. GREEN preserves marker/fixedcode, resolvesvoid, writesonce andexactsuccesspayload.
7. Existingboundedofflineharness; no installs/fullsuite/provider/AI/CI/build/deploy/schema/env.
8. Wholefilebaseline restoration andindependentreview; caller-providedauditmetadata remainsoutside scope.
9. Currentnative observation timeout isnotprocessfailure; no restart/appinteraction/prompt.
10. Evidence/board/localbundle, all21parents and corependingdecision preserved.
