import 'server-only';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
/** One fixed repository source for both independent review currentness and the
 * final transport. No caller path, provider access or permission is supplied. */
export async function readPlatformTemplateBytes():Promise<Buffer>{
 try{
  const bytes=await readFile(path.join(process.cwd(),'public/aws/axiom-agent-quick-deploy.yaml'));
  if(!bytes.length||bytes.length>256*1024)throw Error('unavailable');
  return bytes;
 }catch{throw Error('platform_template_source_unavailable')}
}
