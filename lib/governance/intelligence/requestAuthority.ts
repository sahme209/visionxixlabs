import 'server-only';
import type {NextRequest} from 'next/server';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {createPrivateGovernanceRequestAuthority} from './requestAuthorityCore';
export type * from './requestAuthorityCore';
export function createGovernanceRequestAuthority(request:NextRequest){return createPrivateGovernanceRequestAuthority(request,resolveRequestDesktopSession)}
