import type {TimePublication} from './record';

export interface NanoInterval {low:bigint;high:bigint}
export interface NativeTimeSample {realtimeNs:bigint;p0:NanoInterval;p1:NanoInterval;p2:NanoInterval}
export interface TimePremises {
 /** Qualified precise-monotonic projections of THIS publication's coarse fields.
  * Binding those projections to actual source/clock evidence is the private
  * supplier's responsibility; these plain values are not qualification. */
 asOf:NanoInterval;voidAfter:NanoInterval;maxAgeNs:bigint;
 lambdaMin:{numerator:bigint;denominator:bigint};
 lambdaMax:{numerator:bigint;denominator:bigint};
}
const MAX_NS=(BigInt("1")<<BigInt("63"))-BigInt("1"),MAX_COUNTER=(BigInt("1")<<BigInt("64"))-BigInt("1"),NS_PER_MS=BigInt("1000000"),PPB=BigInt("1000000000");
const fail=():never=>{throw Error('native_time_interval_unavailable')};
function natural(raw:unknown,max=MAX_NS):bigint{if(typeof raw!=='bigint'||raw<BigInt("0")||raw>max)return fail();return raw}
function interval(raw:NanoInterval):Readonly<NanoInterval>{const low=natural(raw.low),high=natural(raw.high);if(high<low)return fail();return Object.freeze({low,high})}
function rate(raw:TimePremises['lambdaMin']){const numerator=natural(raw.numerator),denominator=natural(raw.denominator);if(!numerator||!denominator)return fail();return Object.freeze({numerator,denominator})}
const ceil=(numerator:bigint,denominator:bigint)=>(numerator+denominator-BigInt("1"))/denominator;
const positive=(value:bigint)=>value>BigInt("0")?value:BigInt("0");
/** Pure conditional enclosure at the declared P2 observation, NOT a native
 * qualifier or a guarantee at a later return/commit/provider-dispatch instant.
 * No process/DB clock, guessed padding, rate, lifetime or status fallback.
 * BigInt intermediates remain exact; supported source/output nanoseconds are
 * nonnegative signed64. Rounding to milliseconds widens both endpoints. */
export function encloseTimePublication(raw:Readonly<TimePublication>,rawSample:Readonly<NativeTimeSample>,rawPremises:Readonly<TimePremises>):Readonly<{earliest:number;latest:number}>{
 try{
  // Capture caller primitives once before validating; nothing is awaited or
  // mutated. Real source identity/currentness must be checked by the supplier.
  const publication={version:raw.version,layout:raw.layout,sourceGeneration:raw.sourceGeneration,publication:raw.publication,asOfNs:raw.asOfNs,voidAfterNs:raw.voidAfterNs,boundNs:raw.boundNs,driftPpb:raw.driftPpb,status:raw.status,disruptionMarker:raw.disruptionMarker,disruptionSupported:raw.disruptionSupported};
  if(publication.version!==1||publication.layout!=='clockbound-v2'||typeof publication.sourceGeneration!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(publication.sourceGeneration)||natural(publication.publication,MAX_COUNTER)===BigInt("0")||publication.status!=='synchronized'||publication.disruptionSupported!==true)return fail();
  const originalAsOf=natural(publication.asOfNs),originalVoidAfter=natural(publication.voidAfterNs),bound=natural(publication.boundNs),drift=natural(publication.driftPpb);natural(publication.disruptionMarker,MAX_COUNTER);
  if(originalVoidAfter<=originalAsOf||drift>=PPB)return fail();
  const realtime=natural(rawSample.realtimeNs),p0=interval(rawSample.p0),p1=interval(rawSample.p1),p2=interval(rawSample.p2),asOf=interval(rawPremises.asOf),voidAfter=interval(rawPremises.voidAfter),maxAge=natural(rawPremises.maxAgeNs),minimum=rate(rawPremises.lambdaMin),maximum=rate(rawPremises.lambdaMax);
  if(!maxAge||minimum.numerator*maximum.denominator>maximum.numerator*minimum.denominator||voidAfter.low<=asOf.high||p0.low<asOf.high||p0.low>p1.low||p0.high>p1.high||p1.low>p2.low||p1.high>p2.high||p2.high>=voidAfter.low||p2.high>=asOf.low+maxAge)return fail();
  const deltaR=p1.high-asOf.low,error=bound+ceil(drift*deltaR,PPB);
  const deltaMin=positive(p2.low-p1.high),deltaMax=positive(p2.high-p0.low);
  const lower=realtime-error+(minimum.numerator*deltaMin)/minimum.denominator;
  const upper=realtime+error+ceil(maximum.numerator*deltaMax,maximum.denominator);
  if(lower<BigInt("0")||upper<lower||upper>MAX_NS)return fail();
  const earliest=Number(lower/NS_PER_MS),latest=Number(ceil(upper,NS_PER_MS));
  if(!Number.isSafeInteger(earliest)||!Number.isSafeInteger(latest))return fail();
  return Object.freeze({earliest,latest});
 }catch{return fail()}
}
