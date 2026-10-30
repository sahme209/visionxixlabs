# Read-only journal-proof digest value compatibility

The native journal now contains exactly the authorized note. Its visible raw value hashes to payload digest c6354ffc5c3011413e9ef83fcb118e9bec2ab267deab18dee945e8a991d2c595; its note-string digest is bd570cbeade4509f5d3e085fe0fc0317fc05486edb3a4911e880a41e882857e8. The application's read-only proof did not establish that presence. Do not infer absence or resend.

One concrete local compatibility defect is reproduced: the resource compares the GlideDigest result with strict equality without converting a platform string wrapper to a JavaScript primitive. The new boxed-string test returns false on the old source and true after wrapping the digest with String(...).toLowerCase(). ServiceNow documents a hexadecimal string result; normalizing its representation does not alter SHA256 or the expected exact note. This is a reproduced hazard, not yet a confirmed diagnosis of the live mismatch.

Proposed provider update: replace only that digest comparison in the existing GET resource. Keep all scope, OAuth, ACL, exact record, ASCII/size, duplicate and digest checks. No new fields, journal data exposure, writes, role or grant. Then perform one exact read-only presence check, not a note retry. If still unproved, stop and inspect rather than resubmit.

Local actual-resource tests pass. Installation of this provider script change requires specific approval; no Vercel rollout is involved.
