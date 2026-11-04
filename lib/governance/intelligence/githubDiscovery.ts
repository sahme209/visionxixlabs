import 'server-only';
import {resolveReleaseInstallationToken} from '@/lib/connectors/github/githubAppAuth';
import {createGithubGovernanceDiscoveryCore} from './githubDiscoveryCore';
export function createGithubGovernanceDiscovery(ports:Omit<Parameters<typeof createGithubGovernanceDiscoveryCore>[0],'resolveToken'>&{resolveToken?:typeof resolveReleaseInstallationToken}){return createGithubGovernanceDiscoveryCore({...ports,resolveToken:ports.resolveToken??resolveReleaseInstallationToken})}
