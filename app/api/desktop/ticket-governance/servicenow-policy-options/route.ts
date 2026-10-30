import {NextRequest} from 'next/server';import {handleServiceNowTerminalPolicyOptions} from '@/lib/desktop/serviceNowTerminalPolicyOptions';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:NextRequest){return handleServiceNowTerminalPolicyOptions(request)}
