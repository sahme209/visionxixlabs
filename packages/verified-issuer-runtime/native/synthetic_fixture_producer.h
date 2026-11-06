#ifndef AX_SYNTHETIC_FIXTURE_PRODUCER_H
#define AX_SYNTHETIC_FIXTURE_PRODUCER_H
#include "origin_private_resource_supplier.h"
/* Root maintenance only; fixed owned helper, no caller supplied material/target. */
int ax_fixture_prepare_once(AxiomPrivateMaterial*);
/* Called only on the actual new-item/locator success path; no token getter. */
int ax_fixture_authorization_locators_published(void);
int ax_fixture_commit_and_run_controller(void);
void ax_fixture_discard_authorization(void);
#endif
