"""Source boundary checks; never loads native code or calls Security."""
from pathlib import Path
p=Path('packages/verified-issuer-runtime/native')
a=(p/'synthetic_resource_provisioner.m')
assert a.exists(), 'native adapter missing'
s=a.read_text()
assert 'SecItemAdd(' in s and 'renameatx_np(' in s and 'RENAME_EXCL' in s
assert 'O_EXCL' in s and 'O_NOFOLLOW' in s
assert 'SecItemUpdate(' not in s and 'SecItemDelete(' not in s
s=(p/'origin_private_resource_supplier.m').read_text()
assert 'kSecMatchItemList' in s and 'SecKeychainItemCopyContent' in s
assert 'return 0;' in s.split('int axiom_private_supplier_operational(void)')[1].split('}')[0]
print('PASS source boundary checks (not behavioral/OS qualification)')
