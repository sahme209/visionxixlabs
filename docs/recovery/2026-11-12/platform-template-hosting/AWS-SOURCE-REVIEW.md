# AWS template API source review — public documentation only

Owner approved up to three official AWS pages. Exactly these three distinct pages were read; this exception is consumed. Same-page extraction was used to locate details. No authenticated AWS read, SDK transport, credentials, grant or spending was authorized/performed.

- [CreateBucket](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateBucket.html): the documented North Virginia owned-bucket recreation behavior can reset ACLs. The local managed creation profile refuses us-east-1, uses explicit reviewed us-east-2 and does not turn a conflict into success. No public ACL/BPA/versioning changes are made.
- [PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html): conditional nonexistence writes protect an existing key; conflict does not justify an automatic retry under Axiom's stricter rule. Content-addressed keys and full local-byte hashes bind uploads. Versioning is a separately observed prerequisite, not silently enabled.
- [GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html): version IDs select exact versions and require the corresponding version-read permission. Expected owner is explicit. Actual bounded bytes must match local template bytes before signing; a missing/unversioned selector refuses. No new IAM grant is implied.

Installed SDK3.1166.0 source and a transport-forbidden pure synthetic signing check established its actual query-parameter profile, including the constant unsigned-payload marker. Signature/query validation is local compatibility checking, not live AWS credential validity or custody qualification. Live API, permissions, resource state and customer CloudFormation consumption remain unverified.
