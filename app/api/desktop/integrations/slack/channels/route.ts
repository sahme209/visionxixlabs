import {type NextRequest} from 'next/server';
import {handleSlackChannels} from '@/lib/desktop/slackChannelsHttp';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=20;
export function GET(request:NextRequest){return handleSlackChannels(request)}
