/** Scheduled publication requires a qualified service identity tied to each
 * exact independently reviewed action and current human authority. CRON_SECRET
 * authenticates invocation only. Until that supplier is qualified, this route
 * does not scan drafts, decrypt credentials, claim actions or send requests.
 * This is an explicit incomplete operation, not completed scheduled coverage.
 */
import {NextResponse,type NextRequest} from 'next/server';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:NextRequest){return handle(request)}
export async function POST(request:NextRequest){return handle(request)}
function handle(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!secret)return NextResponse.json({ok:false,reason:'cron_not_configured'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({ok:false,reason:'cron_unauthorized'},{status:401});
 return NextResponse.json({ok:false,reason:'platform_scheduled_service_authority_unavailable',executionEnabled:false},{status:503});
}
