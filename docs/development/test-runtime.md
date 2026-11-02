# Local test runtime

Use `nvm use` from the repository root; `.nvmrc` pins the already verified Node24.21.0 runtime. Then run `npm test`. No package installation or production runtime change is performed by this file.

The installed provenance verifier supports Node ^22.22.2, ^24.15.0 or >=26. Node25.2.1 is outside that library contract. Provenance verification deliberately refuses that unsupported runtime before authority/token/provider callbacks; tests must not mock the refusal away just to pass. An isolated unchanged174-test evidence batch and separate unsupported-runtime regression passed on the installed supported runtime. These local results are not a live provider provenance receipt.

The portable test launcher separately disables Node's optional built-in web storage only when the flag is supported, preserving jsdom browser storage in workers. It retains the selected executable, arguments, exit and signals. This is test environment isolation, not a change to Axiom privacy or customer storage. Six subprocess tests and13 privacy tests cover the observed behavior.

If another supported runtime is chosen, run all tests and the required build/typing checks there and record its exact version. Never widen production trust checks, accept expired real evidence, install a global credential or change provider settings to resolve a local runtime mismatch. Production runtime availability/authorization is a separate deployment gate.
