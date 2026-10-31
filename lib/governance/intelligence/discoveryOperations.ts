/** Closed metadata operations shared by evidence contracts and collectors. */
export const READ_OPERATIONS={github:['repository.identity','repository.rules','repository.workflow_permissions','repository.workflows'],aws:['iam.roles','iam.policy_versions','infrastructure.inventory']}as const;
