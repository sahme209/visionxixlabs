import Image from 'next/image';
import {CodeBracketIcon} from '@heroicons/react/24/outline';
import {INTEGRATION_LOGOS} from '@/lib/marketing/integrationLogos';
/** Referential vendor marks, never connected-state or endorsement signals.
 * No remote image fetch or caller-built asset path. See public logo NOTICE. */
export function IntegrationCatalogLogo({id}:{id:string}){
 const existing=INTEGRATION_LOGOS.find(item=>item.id===id)?.logo;
 const src=id==='azure'?'/brands/azure.svg':id==='dagster'?'/logos/integrations/dagster.svg':existing;
 if(!src)return <span className="integration-catalog-logo" data-logo-kind="generic-editor" title="Generic editor symbol, not a vendor logo"><CodeBracketIcon className="h-8 w-8" aria-hidden="true" /></span>;
 const monochrome=id!=='azure'&&id!=='dagster';
 return <span className="integration-catalog-logo"><Image src={src} width={40} height={40} alt="" aria-hidden="true" unoptimized className={monochrome?'integration-catalog-mark is-monochrome':'integration-catalog-mark'} /></span>;
}
