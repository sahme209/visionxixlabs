import type {NextRequest} from 'next/server';
import {guidedHttp} from '@/lib/cloud/gcp/guided/http';
export const dynamic='force-dynamic';export const runtime='nodejs';
export const GET=(request:NextRequest)=>guidedHttp(request,'status');
