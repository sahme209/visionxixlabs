# Protected staged reads

Staged HTTP smoke checks used the connected Vercel web-fetch capability under the existing account. That capability creates or reuses deployment-scoped temporary share access (new links expire23hours); no share URL/token/header was printed or persisted in release files. No project-wide automation bypass key was generated, Deployment Protection was not disabled, and no global protection setting was changed. Do not invoke installed CLI50 vercel curl, whose implementation can generate a project-wide automation token.

These are HTTP response/source observations, not a new rendered/native interaction acceptance. Seven pages returned200, staged public status remainedUNKNOWN, and the no-session desktop conversation request returned401. Existing accepted local browser/source evidence retains its original scope.
