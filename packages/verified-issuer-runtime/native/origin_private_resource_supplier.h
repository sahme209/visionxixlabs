#ifndef AXIOM_PRIVATE_RESOURCE_SUPPLIER_H
#define AXIOM_PRIVATE_RESOURCE_SUPPLIER_H
#include <stddef.h>
#include <stdint.h>
#include <stdatomic.h>
typedef struct {unsigned char datasource[8192],vault[32],session[4096];size_t datasource_length,session_length;} AxiomPrivateMaterial;
/* Called once, only by the new dedicated custodian before worker creation. */
int axiom_private_supplier_startup(void);
/* Actual selected principal/protected installation/current owner checks.
 * Default missing selection refuses; no runtime override/receipt grants access.
 * Effective item policy and operational qualification remain separate. */
int axiom_private_supplier_operational(void);
int axiom_private_supplier_read(AxiomPrivateMaterial*,const atomic_int*cancelled,uint64_t deadline);
void axiom_private_material_wipe(AxiomPrivateMaterial*);
#endif
