# Installed public macOS VM contract review

Scope: installed SDK headers/man pages only. No network, new provider reads, native experiment, process inventory, initializer, mount, profile, source/runtime change or duplicate native-author fixture. Original trusted-localhost scope is unchanged.

## Supported interpretation

1. `mach/vm_region.h:121–128` explicitly restricts SM_* interpretation to debugging/best-effort accounting: values are loosely defined, sometimes cannot be returned correctly, and may change with VM internals. `SM_TRUESHARED` is 5, not a documented benign-anonymous classification. This limitation also applies to treating SM_PRIVATE/COW alone as a security proof.
2. `vm_region.h:137–144` gives a different meaning to SM_TRUESHARED for submaps: shared machine-level mappings/page tables. Collector must finish recursion and positively inspect `is_submap` before interpreting object fields. The native author confirms the current reported refusal is a leaf, not a proven submap traversal bug.
3. `vm_region.h:240–252` calls protection present access, max_protection maximum available through vm_prot, and external_pager an object-only field. With vm_prot.h:87–101, prot0 is current no access and max7 includes read/write/execute. This is neither proof a write upgrade succeeds nor proof it cannot. `external_pager=0` is not documented as positive anonymous/guard/no-vnode backing evidence.
4. `sys/proc_info.h:166–187,316–333` defines proc region metadata plus vnode stat/fsid/path. Positive, exact region-correlated vnode information can identify file backing. No field here promises that an empty/failed region filename proves anonymous backing or that missing path evidence covers all mappings. `user_tag`, resident counts, shadow depth and inheritance are corroborating metadata, not declared backing-kind authority.
5. `vm_region_basic_info_64` has shared/reserved booleans, but the inspected header provides no semantic guarantee that reserved establishes an immutable harmless guard allocation. Do not silently convert reserved or VM_MEMORY_GUARD labels to a qualification whitelist.
6. Installed mmap(2): MAP_PRIVATE changes are copy-on-write; MAP_SHARED changes are shared. close(2) does not unmap pages (lines253–256). A current descriptor scan alone cannot exclude retained mappings. Creation of MAP_SHARED+PROT_WRITE requires a descriptor open for writing (lines281–299); that rule does not prove arbitrary preexisting mapping upgrade rights from current descriptor metadata. mprotect(2): requested protections may conflict with current process range permissions and fail EACCES (lines110–113).

## Consequence / next decision

The observed `(share=5, prot=0, max=7, external=0)` tuple is ambiguous under the installed public contract. It cannot itself be allowlisted as harmless anonymous memory, and it is not itself proof of a writable file-backed exposure. The native author's owned differential comparison can reveal concrete field/collector errors or demonstrate collisions; it cannot transform best-effort metadata into a stronger guarantee.

If a positive exact vnode/region association is obtained, evaluate the mapped object's actual backing protection within the reviewed trusted-localhost mechanism. If baseline anonymous/guard and retained shared-file cases remain indistinguishable through supported evidence, keep that classification unknown and identify the missing narrow backing/provenance evidence. Do not invent anonymous proof from absent path, whitelist address/tag/share tuple, require hostile-host/network/universal-process proof, or rerun the failed native initializer. Runtime identity and activation remain unavailable.

## Reproducible installed artifacts

SDK: /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk

- usr/include/mach/vm_region.h SHA256 d872aab626ae7c83b6451400de146b469e7d5a7454dbbf539524fe94f2e20ea7
- usr/share/man/man2/mmap.2 SHA256 ccc6064c76ad2b01d7e82b0079d3e8ed3d84878c086aa300f12fb3eeb5645659
- usr/share/man/man2/mprotect.2 SHA256 818ececb641630643b612ae2cc1700e91d982ab88c5592c4f7cf3b68f1c174a9

No collector defect proven by this review. This is API-contract interpretation, not positive runtime acceptance.

## Subsequent owned-author observation (not rerun by this reviewer)

The native author reports the first actual controlled comparison: baseline leaf `(prot0,max7,share5,external0,tag1,inherit1,named0)`; owned file `MAP_SHARED` initially read/write, changed to read-only and descriptor closed reports `(prot1,max7,share2/SM_PRIVATE,external1,tag0,inherit0,named1)`. Current classifier allowed the latter. Thus a concrete false-allow exists in the private-share-mode predicate, not merely a hypothetical missing contract. This observation is attributed to the independent fixture author; its raw output and source receipt remain theirs. No store/write/fault experiment was duplicated here. Further source correction belongs to that author's reviewed scope, preserving the unknown baseline and real shared-file negative rather than inventing a whitelist.

## Bounded shared/inheritance followup

`mach_vm.defs:433–440` says returned protection, inheritance, sharing and object values cover the entire returned range. However the installed `vm_region_basic_info_64.shared` declaration does not state whether it records original MAP_SHARED/copy=false semantics or current object-sharing state, nor that false proves private/COW backing. The SM_* warning specifically addresses its enumerated modes; it must not be automatically misquoted as a warning about this separate boolean. The inspected contract does not resolve the boolean's sufficient-security meaning in either direction.

`mach_vm.defs:193–207` explicitly makes inheritance an attribute determining what a future task_create child acquires, and exposes its setter. `vm_inherit.h:85–87` defines share/copy/none in those child terms. Installed minherit(2):52–60 likewise changes inheritance to COPY/SHARE/NONE. Therefore VM_INHERIT_COPY is not proof that an existing mapping is private from all other references. No API execution or new mapping experiment was performed for this followup.

Additional installed hashes: mach/mach_vm.defs 74c55e3c884f08bb3bfb29bd2bf5c952f235954af6fb65ce310e916b46de6728; mach/vm_inherit.h db0db4c2ca0627076fab369bab78820d16dc156c83fcd62181c4fcf30507dacd; man2/minherit.2 f0804b504fdbbd361998863f60b99aa2b50f90b7074a44b618b6058fe1b44a43.

Final independent diagnostic source/output is now preserved at ../native-mapping-causal-comparison/. It also demonstrates one-alias POSIX shared memory reporting SM_PRIVATE/external0/max3 and the shared-file mode changing after a second alias. These actual counterexamples are decisive against the original private-mode predicate; this contract review does not supersede or duplicate them.
