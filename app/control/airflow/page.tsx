import { redirect } from 'next/navigation';
import { currentContext } from '@/lib/auth/currentContext';
import { AirflowConsole } from '@/components/cockpit/AirflowConsole';
export const dynamic='force-dynamic';
export default async function AirflowPage(){
 const context=await currentContext();
 if(!context.isAuthenticated || !context.userId || !context.organizationId)redirect('/auth/signin?callbackUrl=%2Fcontrol%2Fairflow');
 if(!context.roles.length)return <p role="alert">A current workspace membership is required to view Airflow.</p>;
 return <div><h1>Airflow</h1><p className="mt-1 text-[13px] leading-5 text-zinc-400">Monitor DAGs, task state, and governed automations across your workspace.</p><AirflowConsole/></div>;
}
