import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
/** Narrow actual checked-in source graph; no shared generation or product mocks. */
export function loadAirflowReviewHarness() {
  const require = createRequire(import.meta.url), ts = require("typescript"), prior = require.extensions[".ts"];
  try {
    require.extensions[".ts"] = (module, path) => {
      assert.ok(path.startsWith(`${root}/lib/`), "owned_airflow_source_graph_required");
      const source = readFileSync(path, "utf8").replace(/^import ["']server-only["'];?\s*$/gm, "").replace(/(["'])@\//g, (_match, quote) => `${quote}${root}/`);
      module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, path);
    };
    return { ...require(join(root, "lib/integrations/airflow/restartReview.ts")), ...require(join(root, "lib/integrations/airflow/restartReviewStore.ts")),
      ...require(join(root, "lib/integrations/airflow/restartReviewIO.ts")), ...require(join(root, "lib/billing/deploymentDispatchReservation.ts")), ...require(join(root, "lib/security/apiKeyCrypto.ts")) };
  } finally { if (prior) require.extensions[".ts"] = prior; else delete require.extensions[".ts"]; }
}
