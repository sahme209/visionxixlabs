// Fixed, reviewed native compiler; compiler-API users keep the pinned JS package.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const packagePath = require.resolve('@typescript/native/package.json');
const metadata = require(packagePath);
if (metadata.name !== 'typescript' || metadata.version !== '7.0.2') {
  throw new Error('native_typescript_version_unreviewed');
}
// Importing the official wrapper preserves its exit code and signal behavior;
// its process replacement receives exactly the original command-line arguments.
await import(pathToFileURL(join(dirname(packagePath), 'lib/tsc.js')).href);
