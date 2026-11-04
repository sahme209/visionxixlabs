import 'server-only';
import {consumeReleaseInstallationEligibility} from '@/lib/connectors/github/githubAppAuth';
import {createMergeProviderEligibility as createCore} from './mergeProviderEligibilityCore';
export function createMergeProviderEligibility(ports:Omit<Parameters<typeof createCore>[0],'consumeReleaseInstallationEligibility'>){return createCore({...ports,consumeReleaseInstallationEligibility})}
