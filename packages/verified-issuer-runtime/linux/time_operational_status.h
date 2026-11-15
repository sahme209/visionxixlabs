#ifndef AXIOM_OPERATIONAL_STATUS_H
#define AXIOM_OPERATIONAL_STATUS_H
#include <stdint.h>
#include <stddef.h>
#define AXIOM_OPERATIONAL_ACCEPT_FD 8
#define AXIOM_OPERATIONAL_CHECK_FD 9
#define AXIOM_OPERATIONAL_STATUS_FD 10
#define AXIOM_OPERATIONAL_DAEMON_FD 11
#define AXIOM_OPERATIONAL_WIRE_MAX 4096u
#define AXIOM_OPERATIONAL_DEADLINE_NS 500000000u
/* Closed ASCII LF frames; no embedded NUL, CR, leading-zero integer, unknown
 * field, extension or trailing byte. A reply is for ONE request, never a cache. */
enum axiom_operational_state { AXIOM_OP_UNKNOWN=0, AXIOM_OP_READY=1,
 AXIOM_OP_DISRUPTED=2, AXIOM_OP_WITHDRAWN=3 };
/* Immutable semantic policy has no runtime identity or claimed digest. */
struct axiom_operational_policy {uint64_t revision,reader_uid,reader_gid;};
struct axiom_operational_acceptance {
 char profile[65],host[129],source_generation[129],boot[129];
 uint64_t revision,directory_device,directory_inode,publisher_uid,reader_gid;
};
struct axiom_operational_status {
 uint64_t sequence,revision,publication,marker,transition;
 char profile[65],host[129],source_generation[129];
 enum axiom_operational_state state;
};
int axiom_operational_policy_decode(const unsigned char*,size_t,struct axiom_operational_policy*);
/* Pure derivation only. The fixed root owner supplies verified digest and held
 * kernel facts. This helper does not qualify or enroll any package. */
int axiom_operational_accept_derive(const struct axiom_operational_policy*,const char*,const char*,uint64_t,uint64_t,const unsigned char*,size_t,struct axiom_operational_acceptance*);
int axiom_operational_accept_decode(const unsigned char*,size_t,struct axiom_operational_acceptance*);
int axiom_operational_accept_encode(const struct axiom_operational_acceptance*,unsigned char*,size_t*);
int axiom_operational_status_decode(const unsigned char*,size_t,struct axiom_operational_status*);
int axiom_operational_status_encode(const struct axiom_operational_status*,unsigned char*,size_t*);
int axiom_operational_check_decode(const unsigned char*,size_t,struct axiom_operational_status*);
int axiom_operational_check_encode(const struct axiom_operational_status*,unsigned char*,size_t*);
int axiom_operational_same(const struct axiom_operational_status*,const struct axiom_operational_status*);
/* Poll and read/write use a single original monotonic deadline, nonblocking FDs.
 * The reader stops exactly at END LF and rejects bytes queued beyond the frame. */
int axiom_operational_exchange(int,int,const struct axiom_operational_status*,struct axiom_operational_status*,uint64_t);
int axiom_operational_read_frame(int,unsigned char*,size_t*,uint64_t);
int axiom_operational_write_frame(int,const unsigned char*,size_t,uint64_t);
int axiom_operational_monotonic(uint64_t*);
int axiom_operational_daemon_initialize(void);
int axiom_operational_daemon_publish(uint64_t,uint64_t,uint32_t);
#endif
