import {useEffect,useState} from 'react';
import {actionJourney} from '../../../lib/customerJourney/journey';
import {CustomerJourneyPanel} from '../../../components/shared/CustomerJourneyPanel';
type Observation=Omit<Parameters<typeof actionJourney>[0],'now'>;
export function ActionJourney({observation,label}:{observation:Observation;label:string}){
 const [clock,setClock]=useState(()=>Date.now());
 useEffect(()=>{const remaining=Date.parse(observation.expiresAt)-Date.now();if(!Number.isFinite(remaining)||remaining<=0)return;const timer=setTimeout(()=>setClock(Date.now()),Math.min(remaining+1,2147483647));return()=>clearTimeout(timer)},[observation.expiresAt,clock]);
 return <CustomerJourneyPanel label={label} journey={actionJourney({...observation,now:Math.max(clock,Date.now())})}/>;
}
