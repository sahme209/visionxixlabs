# Unimplemented pipeline stage boundary

The registry previously installed successful dry-run defaults for unimplemented build, test, deployment, schema and notification stages. A real run could therefore finish without performing its advertised work. Bootstrap now installs an explicit failed/unavailable result while preserving any registered implementation. The exported, clearly labeled preview helper remains available only when explicitly requested.

Four default-stage regression cases failed before the change. Seven focused cases now pass, including an actual runner/registry test that records an unavailable notification and its containing run as failed, never completed. No external provider action was used. This does not implement missing deployment, test or notification adapters; those remain unavailable until securely configured and tested. Release validation is recorded separately.
