import {type NextRequest} from 'next/server';
import {jiraReporterHttp} from '@/lib/integrations/jira/jiraTicketWriteRuntime';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const POST=(request:NextRequest)=>jiraReporterHttp.start(request);
