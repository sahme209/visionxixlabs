import 'server-only';
import type {NextRequest} from 'next/server';
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {createPrivateEnrollmentDrainAuthority} from './enrollmentDrainAuthorityCore';
export type * from './enrollmentDrainAuthorityCore';
export function createEnrollmentDrainAuthority(request:NextRequest){return createPrivateEnrollmentDrainAuthority(request,resolveRequestDesktopSession)}
