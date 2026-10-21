import {expect, it} from "vitest";
import {isSensitiveRepositoryEvidencePath} from "../repositoryEvidencePolicy";
it.each([".env", "config/.ENV.local", "nested/credentials/prod.json", ".aws/config", "keys/private.pem", "config/app-secret.json", "config/.npmrc", ".ssh/id_ed25519"])("keeps sensitive evidence restricted: %s", path => {
  expect(isSensitiveRepositoryEvidencePath(path)).toBe(true);
});
it.each(["src/app.ts", "README.md", "src/notsecret.ts", "nested/", ""])("preserves ordinary path behavior: %s", path => {
  expect(isSensitiveRepositoryEvidencePath(path)).toBe(false);
});
