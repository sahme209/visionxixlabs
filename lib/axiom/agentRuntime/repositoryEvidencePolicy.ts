/** Known sensitive repository paths are excluded from Agent evidence and writes. */
export function isSensitiveRepositoryEvidencePath(path: string): boolean {
  const normalized = path.toLowerCase();
  const fileName = normalized.split("/").at(-1) ?? normalized;
  return fileName.startsWith(".env") || [".npmrc", ".pypirc", ".netrc"].includes(fileName)
    || normalized.split("/").some((segment) => [".git", ".aws", ".ssh", ".kube", "secrets", "credentials"].includes(segment))
    || /(^|[._-])(secret|secrets|credential|credentials)([._-]|$)/.test(fileName)
    || /(^|\/)(id_rsa|id_ed25519)(\.|$)/.test(normalized)
    || /\.(pem|key|p12|pfx|jks|keystore)$/.test(fileName);
}

