import {z} from 'zod';
/** Accepted facts from trusted server-owned storage, never a requested OAuth grant.
 * Initial consent and write/profile upgrade purposes retain their own scope lists.
 * Refresh callers must still compare returned scopes to the exact stored grant.
 */
export const jiraRecordedScopesSchema=z.array(z.enum(['read:jira-work','write:jira-work','offline_access','read:me'])).min(1).max(4).refine(s=>s.includes('read:jira-work')&&new Set(s).size===s.length);
