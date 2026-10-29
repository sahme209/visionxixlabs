import type {NextRequest} from 'next/server';
import {handlePullRequestEvidenceRun} from '@/lib/axiom/bot/pullRequestEvidenceHttp';
export const dynamic='force-dynamic';export const runtime='nodejs';
async function handle(request:NextRequest,context:{params:Promise<{id:string}>}){return handlePullRequestEvidenceRun(request,(await context.params).id)}
export const GET=handle;export const DELETE=handle;
