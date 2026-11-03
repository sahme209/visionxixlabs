import 'server-only';
import { readLocalIssuerArtifactIdentity } from '@/lib/governance/intelligence/issuerArtifactIdentity';
/** No source/env/PID assertion can qualify the current executing issuer. */
export function readCodingOutboundIssuerDigest(): string { void readLocalIssuerArtifactIdentity(); throw Error('coding_outbound_issuer_unavailable'); }
