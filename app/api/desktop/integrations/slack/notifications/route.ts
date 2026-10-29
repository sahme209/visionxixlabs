import type {NextRequest} from 'next/server';
import {handleSlackNotifications} from '@/lib/desktop/slackNotificationsHttp';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export function GET(request:NextRequest){return handleSlackNotifications(request)}
export function POST(request:NextRequest){return handleSlackNotifications(request)}
