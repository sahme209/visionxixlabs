#ifndef AXIOM_OWNER_CONFIG_H
#define AXIOM_OWNER_CONFIG_H
#include "synthetic_resource_contract.h"
#define AX_OWNER_PROFILE_UNSELECTED 0
#define AX_OWNER_PROFILE_LEGACY 1
#define AX_OWNER_PROFILE_SYSTEM 2
#ifndef AX_OWNER_PROFILE
#define AX_OWNER_PROFILE AX_OWNER_PROFILE_UNSELECTED
#endif
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
#ifndef AX_FIXTURE_FIXED_UID
#define AX_FIXTURE_FIXED_UID 0
#endif
#ifndef AX_FIXTURE_FIXED_GID
#define AX_FIXTURE_FIXED_GID 0
#endif
/* Fixed owned qualification controller; no real principal selected by default. */
#ifndef AX_FIXTURE_CONTROLLER_UID
#define AX_FIXTURE_CONTROLLER_UID 0
#endif
#ifndef AX_FIXTURE_CONTROLLER_GID
#define AX_FIXTURE_CONTROLLER_GID 0
#endif
/* No synthetic diagnostic lifetime is silently a production lease. */
#ifndef AX_OWNER_MAX_LIFETIME_NS
#define AX_OWNER_MAX_LIFETIME_NS 0ULL
#endif
#endif
