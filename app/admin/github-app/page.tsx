import {redirect} from 'next/navigation';
import {currentContext} from '@/lib/auth/currentContext';
import {isPlatformAdmin} from '@/lib/auth/platformAdmin';
import GitHubAppSetup from '@/app/dashboard/github-app/page';
export const dynamic='force-dynamic';
export default async function PlatformGitHubAppPage(){
 const context=await currentContext();
 if(!context.isAuthenticated)redirect('/auth/signin?callbackUrl=/admin/github-app');
 if(!isPlatformAdmin(context.email))redirect('/control/integrations');
 return <GitHubAppSetup/>;
}
