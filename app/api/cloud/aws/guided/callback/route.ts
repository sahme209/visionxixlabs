import {type NextRequest} from 'next/server';
import {handleAwsGuidedCallback} from '@/lib/cloud/aws/guided/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const POST=(request:NextRequest)=>handleAwsGuidedCallback(request);
