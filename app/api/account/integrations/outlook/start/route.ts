import {startOutlookBrowser} from '@/lib/integrations/outlook/outlookBrowserHttp';
import type {NextRequest} from 'next/server';
export const dynamic='force-dynamic';export const runtime='nodejs';
export const POST=(request:NextRequest)=>startOutlookBrowser(request,'read');
