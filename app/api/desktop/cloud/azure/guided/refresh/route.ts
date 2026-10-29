import {type NextRequest} from 'next/server';
import {azureGuidedHttp} from '@/lib/cloud/azure/guided/http';
export const dynamic='force-dynamic';export const runtime='nodejs';
export const POST=(request:NextRequest)=>azureGuidedHttp(request,'refresh');
