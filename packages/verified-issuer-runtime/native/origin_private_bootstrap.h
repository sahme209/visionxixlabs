#ifndef AXIOM_PRIVATE_BOOTSTRAP_H
#define AXIOM_PRIVATE_BOOTSTRAP_H
#include "origin_private_resource_supplier.h"
#define AXIOM_PRIVATE_FRAME_CAP 32768U
#define AXIOM_PRIVATE_FRAME_HEADER 112U
typedef struct {uint64_t epoch,deadline;unsigned char client[32],broker[32];} AxiomPrivateBinding;
/* Exactly one fixed record; no selectors, optional fields, or caller config. */
int axiom_private_frame_encode(unsigned char out[AXIOM_PRIVATE_FRAME_CAP],size_t*length,const AxiomPrivateBinding*,const AxiomPrivateMaterial*);
int axiom_private_frame_read(int fd,const AxiomPrivateBinding*,AxiomPrivateMaterial*);
#endif
