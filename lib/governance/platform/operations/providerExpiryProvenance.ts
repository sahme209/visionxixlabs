/** Nonsecret original metadata exposed only by the actual private supplier
 * instance after a validated provider response. This is not complete custody,
 * fleet, renewal-cutoff or in-flight proof; closure must separately qualify it. */
export interface ObservedProviderExpiry {
 readonly leaseRef:string;readonly expiresAt:number;readonly scope:'source'|'derived';
 readonly provider:'aws-sts-temporary';readonly manifestDigest:string;readonly issuerProfileDigest:string;
}
export interface ProviderExpiryReader {readObservedProviderExpiry(leaseRef:string):Readonly<ObservedProviderExpiry>|null}
