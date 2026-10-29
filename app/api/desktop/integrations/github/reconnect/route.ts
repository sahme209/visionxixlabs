import type {NextRequest} from 'next/server';
import {handleGithubInstallationReconnect} from '@/lib/desktop/githubInstallationReconnectHttp';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=25;
export function POST(request:NextRequest){return handleGithubInstallationReconnect(request)}
