#ifndef AXIOM_ISSUER_ORIGIN_SESSION_H
#define AXIOM_ISSUER_ORIGIN_SESSION_H
/* Native-only session. No public endpoint, callback, PID, nonce or JS authority. */
#include <stdint.h>
#include "request_protocol.h"
typedef struct {int cancelled;char id[65];size_t length;unsigned char bytes[AX_REQUEST_INPUT_CAP];} AxiomRequestEvent;
typedef struct AxiomOriginSession AxiomOriginSession;
#define AXIOM_ORIGIN_EXCHANGE_NS 250000000ULL
AxiomOriginSession *axiom_origin_session_open(void);
int axiom_origin_session_assert(AxiomOriginSession *session);
int axiom_origin_session_locally_valid(AxiomOriginSession *session);
int axiom_origin_session_bootstrap_binding(AxiomOriginSession*,uint64_t *epoch,uint64_t *deadline,unsigned char client[32],unsigned char broker[32]);
void axiom_origin_session_revoke(AxiomOriginSession *session);
void axiom_origin_session_destroy(void *session);
int axiom_origin_session_next_request(AxiomOriginSession*,AxiomRequestEvent*);
int axiom_origin_session_complete_request(AxiomOriginSession*,const unsigned char id[32],const unsigned char*,size_t);
int axiom_origin_session_request_current(AxiomOriginSession*,const unsigned char id[32]);
#endif
