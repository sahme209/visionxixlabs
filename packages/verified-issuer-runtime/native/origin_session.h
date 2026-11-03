#ifndef AXIOM_ISSUER_ORIGIN_SESSION_H
#define AXIOM_ISSUER_ORIGIN_SESSION_H
/* Native-only session. No public endpoint, callback, PID, nonce or JS authority. */
typedef struct AxiomOriginSession AxiomOriginSession;
#define AXIOM_ORIGIN_EXCHANGE_NS 250000000ULL
AxiomOriginSession *axiom_origin_session_open(void);
int axiom_origin_session_assert(AxiomOriginSession *session);
void axiom_origin_session_revoke(AxiomOriginSession *session);
void axiom_origin_session_destroy(void *session);
#endif
