#ifndef AXIOM_SYSTEM_PEER_BINDING_H
#define AXIOM_SYSTEM_PEER_BINDING_H
#include <sys/stat.h>
#include <stdint.h>
typedef enum {AX_SYSTEM_PEER_OWNER=1,AX_SYSTEM_PEER_BROKER=2} AxSystemPeerRole;
/* Private native state, not a request DTO or issuer receipt. Role paths and
 * signing profile are fixed by the implementation, never caller selectors. */
typedef struct {char requirement[64];int fd,role,captured,revoked,opened;struct stat identity;unsigned char bytes_sha256[32],cdhash[20];} AxSystemPeer;
int ax_system_peer_prepare(AxSystemPeer*,int role);
int ax_system_peer_current(AxSystemPeer*);
void ax_system_peer_revoke(AxSystemPeer*);
const char*ax_system_peer_requirement(AxSystemPeer*);
#endif
