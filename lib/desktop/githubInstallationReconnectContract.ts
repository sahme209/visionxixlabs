import {z} from 'zod';
export const GITHUB_INSTALLATION_RECONNECT_KIND='github_installation_reconnect_v1';
export const githubReconnectChallengeId=z.string().regex(/^github_reconnect_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const githubReconnectChallengeSchema=z.object({challengeId:githubReconnectChallengeId,version:z.literal(0),expiresAt:z.string().datetime(),accountLogin:z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/),accountType:z.enum(['User','Organization']),repositorySelection:z.enum(['all','selected']),providerWritesPerformed:z.literal(false)}).strict();
export type GithubReconnectChallenge=z.infer<typeof githubReconnectChallengeSchema>;
export const githubReconnectConfirmationSchema=z.object({status:z.literal('active'),reconnected:z.literal(true),providerWritesPerformed:z.literal(false)}).strict();
export type GithubReconnectConfirmation=z.infer<typeof githubReconnectConfirmationSchema>;
export const githubReconnectRequestSchema=z.discriminatedUnion('action',[z.object({action:z.literal('verify')}).strict(),z.object({action:z.literal('confirm'),challengeId:githubReconnectChallengeId,expectedVersion:z.literal(0)}).strict()]);
