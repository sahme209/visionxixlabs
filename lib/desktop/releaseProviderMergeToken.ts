import 'server-only';
import {resolveReleaseInstallationToken} from '@/lib/connectors/github/githubAppAuth';
import * as core from './releaseProviderMergeTokenCore';
export type MergeTokenPorts=Omit<core.MergeTokenPorts,'resolveReleaseInstallationToken'>;
export function createReleaseProviderMergeToken(ports:MergeTokenPorts){return core.createReleaseProviderMergeToken({...ports,resolveReleaseInstallationToken})}
export function createReleaseMergePolicyCredential(ports:MergeTokenPorts){return core.createReleaseMergePolicyCredential({...ports,resolveReleaseInstallationToken})}
export function createReleaseReadOnlyMergePolicyCredential(ports:MergeTokenPorts){return core.createReleaseReadOnlyMergePolicyCredential({...ports,resolveReleaseInstallationToken})}
