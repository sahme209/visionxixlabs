import Image from 'next/image';
import {ArrowPathRoundedSquareIcon,BellAlertIcon,ChartBarIcon,CodeBracketIcon,FlagIcon} from '@heroicons/react/24/outline';
import {INTEGRATION_LOGOS} from '@/lib/marketing/integrationLogos';
/** Referential vendor marks, never connected-state or endorsement signals.
 * No remote image fetch or caller-built asset path. See public logo NOTICE. */
export function IntegrationCatalogLogo({id}:{id:string}){
 const existing=INTEGRATION_LOGOS.find(item=>item.id===id)?.logo;
 const src=id==='azure'?'/brands/azure.svg':id==='dagster'?'/logos/integrations/dagster.svg':existing;
 if(!src&&id==='flux')return <span className="integration-catalog-logo" data-logo-kind="generic-gitops" title="Generic GitOps symbol, not a vendor logo"><ArrowPathRoundedSquareIcon className="h-8 w-8" aria-hidden="true" /></span>;
 if(!src&&(id==='sentry'||id==='datadog'))return <span className="integration-catalog-logo" data-logo-kind="generic-monitoring" title="Generic monitoring symbol, not a vendor logo"><ChartBarIcon className="h-8 w-8" aria-hidden="true" /></span>;
 if(!src&&id==='opsgenie')return <span className="integration-catalog-logo" data-logo-kind="generic-alerts" title="Generic alerts symbol, not a vendor logo"><BellAlertIcon className="h-8 w-8" aria-hidden="true" /></span>;
 if(!src&&(id==='launchdarkly'||id==='unleash'))return <span className="integration-catalog-logo" data-logo-kind="generic-flags" title="Generic feature-flag symbol, not a vendor logo"><FlagIcon className="h-8 w-8" aria-hidden="true" /></span>;
 if(!src)return <span className="integration-catalog-logo" data-logo-kind="generic-editor" title="Generic editor symbol, not a vendor logo"><CodeBracketIcon className="h-8 w-8" aria-hidden="true" /></span>;
 const monochrome=id!=='azure'&&id!=='dagster';
 return <span className="integration-catalog-logo"><Image src={src} width={40} height={40} alt="" aria-hidden="true" unoptimized className={monochrome?'integration-catalog-mark is-monochrome':'integration-catalog-mark'} /></span>;
}
