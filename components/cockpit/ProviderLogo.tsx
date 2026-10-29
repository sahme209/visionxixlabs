import Image from 'next/image';
export type ProviderMark = 'github'|'slack'|'teams'|'linear'|'jira'|'airflow'|'aws'|'azure'|'gcp';
export function ProviderLogo({provider,size=20}:{provider:ProviderMark;size?:number}) {
 return <Image src={`/brands/${provider}.svg`} width={size} height={size} alt="" aria-hidden />;
}
