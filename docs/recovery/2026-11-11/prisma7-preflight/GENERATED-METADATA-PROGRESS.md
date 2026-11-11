# Prisma 7 generated metadata compatibility — local progress

The modern generated client no longer exposes `Prisma.dmmf`. Four existing store tests now obtain full model metadata from the actual generated client's embedded schema using the matching Prisma 7 metadata tool. The helper compares that datamodel with the current source schema before returning any model. Missing models and stale generation fail; the original required-field assertions remain unchanged.

Validation: five focused files, 140 tests passed; root native TypeScript check passed. A regression verifies that adding a required field to source without regenerating is rejected. No SQL, network request, credential access, production change or deployment was involved in this unit.

This is not completed Prisma migration acceptance. Ordinary script imports, driver configuration compatibility, broader fixture/package contracts, full tests/builds and independent review remain. The live database discrepancy and unverified Vercel target remain separate deployment blockers. The approved private comparison stopped after one metadata call without reading the decrypted setting; that invocation is consumed.
