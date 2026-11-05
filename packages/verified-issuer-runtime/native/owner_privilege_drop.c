#include "owner_privilege_drop.h"
int ax_owner_drop_privileges(const AxOwnerDropOps*o,uid_t u,gid_t g){
 if(!o||!u||!g||!o->prepare_io||!o->clear_groups||!o->set_gid||!o->set_uid||!o->verify_ids)return 0;
 return o->prepare_io(o->context)&&o->clear_groups(o->context)&&o->set_gid(o->context,g)&&
  o->set_uid(o->context,u)&&o->verify_ids(o->context,u,g);
}
