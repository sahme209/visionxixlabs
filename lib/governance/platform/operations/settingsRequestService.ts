import 'server-only';
import {prisma} from '@/lib/db';
import {verifyDesktopToken} from '@/lib/desktop/desktopToken';
import {readConfiguredPlatformAdmins} from '../currentAuthority';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from '../sqlRepository';
import {createSettingsArtifactRequestComposition} from './settingsArtifactRequest';
const unavailable=async():Promise<never>=>{throw Error('settings_source_qualification_unavailable')};
/** Prepared default, not route-registered. Current-reader history uses actual
 * signed-session SQL. New actions/custody/execution refuse unqualified sources.
 * No environment credential/key fallback or provider access. */
export function createDefaultSettingsRequestService(request:Request){return createSettingsArtifactRequestComposition(request,{
 repo:createPlatformSqlRepository(prisma as unknown as PlatformSqlDatabase),verifyDesktopToken,readAdminEmails:readConfiguredPlatformAdmins,clock:unavailable,
 preparationSource:{assertCurrent:unavailable,readTimeWindow:unavailable},
 source:{readManifest:(tx,id)=>tx.readSettingsManifest(id),assertCurrent:unavailable,readKey:unavailable,readTimeWindow:unavailable},
})}
