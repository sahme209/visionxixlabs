const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');const at=__dirname;
for(const file of ['synthetic_resource_maintenance_main.c','origin_launch_owner.c','origin_owner_binding.c']){const source=fs.readFileSync(path.join(at,file),'utf8');assert(!source.includes('!AX_OWNER_OPERATIONAL'),file+' must use actual derived admission');}
const supplier=fs.readFileSync(path.join(at,'origin_private_resource_supplier.m'),'utf8');assert.match(supplier,/return ax_fixture_supplier_context_current\(\);/);assert.match(supplier,/installation_context\(\)/);
