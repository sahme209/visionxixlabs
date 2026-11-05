#ifndef AXIOM_OWNER_CONFIG_H
#define AXIOM_OWNER_CONFIG_H
#include "synthetic_resource_contract.h"
/* Closed during local source preparation. No build definition may activate it. */
#define AX_OWNER_OPERATIONAL 0
#define AX_OWNER_SERVICE "com.visionxixlabs.axiom.synthetic.launch-owner." AX_SYNTH_GENERATION
#define AX_OWNER_PATH AX_SYNTH_APP "/Contents/Helpers/AxiomSyntheticLaunchOwner"
#ifndef AX_OWNER_REQUIREMENT
#define AX_OWNER_REQUIREMENT ""
#endif
#ifndef AX_OWNER_BROKER_REQUIREMENT
#define AX_OWNER_BROKER_REQUIREMENT ""
#endif
#ifndef AX_OWNER_FIXED_UID
#define AX_OWNER_FIXED_UID 0
#endif
#ifndef AX_OWNER_FIXED_GID
#define AX_OWNER_FIXED_GID 0
#endif
/* No synthetic diagnostic lifetime is silently a production lease. */
#ifndef AX_OWNER_MAX_LIFETIME_NS
#define AX_OWNER_MAX_LIFETIME_NS 0ULL
#endif
#endif
