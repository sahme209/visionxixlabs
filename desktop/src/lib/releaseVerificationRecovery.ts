/** Fixed messages only; raw provider errors and credentials are never rendered. */
export const RELEASE_VERIFICATION_RECOVERY:Record<string,string>={
 release_review_authority_unavailable:'The release, access or independent review changed. Reload this release before reviewing deployment.',
 release_review_source_unavailable:'The exact GitHub tag could not be confirmed. Check the existing connection and the selected release tag.',
 release_review_policy_unavailable:'GitHub could not prove the selected source protection. Review the release protection before requesting deployment.',
 release_review_workflow_unavailable:'The workflow or its inputs no longer match the reviewed source. Read its fields again and save a new reviewed revision.',
 release_immutable_required:'This GitHub release is mutable. Publish an immutable release for the exact source before requesting deployment review.',
};
