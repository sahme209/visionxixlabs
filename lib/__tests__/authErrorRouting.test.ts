import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/db',()=>({prisma:{}}));
import {authOptions} from '@/lib/auth';
const require=createRequire(import.meta.url);
// Exercise the installed NextAuth error dispatcher, not a copied model.
const {AuthHandler}=require(join(dirname(require.resolve('next-auth')),'core/index.js'));
afterEach(()=>vi.unstubAllEnvs());
it('sends the actual AccessDenied dispatcher to our recovery route without echoing a callback or credentials',async()=>{
 vi.stubEnv('NEXTAUTH_URL','https://visionxixlabs.com');
 const response=await AuthHandler({req:{action:'error',method:'GET',headers:{host:'visionxixlabs.com'},query:{error:'AccessDenied'},error:'AccessDenied',cookies:{}},options:{...authOptions,secret:'synthetic-unit-secret-only',providers:[],logger:{error:vi.fn(),warn:vi.fn(),debug:vi.fn()}}});
 expect(response.redirect).toBe('/auth/error?error=AccessDenied');
});
