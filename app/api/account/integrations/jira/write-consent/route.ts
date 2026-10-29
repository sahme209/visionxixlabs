import {jiraTicketWriteHttp} from '@/lib/integrations/jira/jiraTicketWriteRuntime';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const POST=jiraTicketWriteHttp.start;
