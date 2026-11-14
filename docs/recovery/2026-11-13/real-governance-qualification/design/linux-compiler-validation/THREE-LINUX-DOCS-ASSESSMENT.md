# Three-page Linux contract assessment

Owner call_7c9b872478ab4d69b368572e8cc7da5c is consumed: exactly three unique primary pages, plus two section views of the SAME seccomp page. No additional page, code/compiler/filter/probe, dependency, CI retry, administrator action or spending. No downloaded code was executed.

## Established contracts

- [Kernel seccomp documentation](https://docs.kernel.org/userspace-api/seccomp_filter.html): a process can install a filter after setting no-new-privileges, subject to kernel support. Filters survive permitted child creation and exec. Architecture must be checked. Syscall filtering is explicitly not complete process containment.
- [seccomp(2)](https://man7.org/linux/man-pages/man2/seccomp.2.html): use actual UAPI structures/macros; check installation success and refuse errors. x86_64 and x32 share an architecture identifier, so x32 must be separately rejected. Prefer a positive allowlist; a denylist can miss future operations. Filters cannot read pointed-to memory. Avoid notification/trace mechanisms; preserve ordinary failure diagnostics.
- [PR_SET_NO_NEW_PRIVS](https://man7.org/linux/man-pages/man2/PR_SET_NO_NEW_PRIVS.2const.html): the setting is irreversible, inherited across child creation/exec and prevents exec from granting additional privileges. It is not permission to change users, services or host configuration.

## Decision supported, qualification not established

Proceed to a local source/mocked-test proposal for an ordinary-user, fixed C compiler launcher using installed UAPI headers and a positive syscall profile. This is an engineering inference from the contracts, not a documented ready-made compiler policy. The three pages do NOT establish the next runner's configuration, exact compiler syscall needs, installed header identity or containment of arbitrary hostile code. Those must remain explicit limits and later controlled acceptance. No extra source-research loop is needed merely to copy numeric ABI constants.

Existing PR331's actual uid-map refusal remains unchanged. No compiler result, runtime/time authority or Governance activation follows.
