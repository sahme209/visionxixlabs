# Production type-check file-read recovery

The 9ad8c3fc security repair compiled, but the production type process stalled. A one-second process sample showed a synchronous filesystem read, and its open descriptor pointed to the existing EC2 CreateSubnetCommand declaration. Filesystem flags marked it compressed/dataless. A first temporary package restore moved the read past that file; another declaration wait remained. This does not prove which sync service caused the placeholders.

Recovery used a separate temporary node_modules overlay. Restore the existing root lockfile versions of @aws-sdk, @smithy, @azure and @google-cloud packages from the official npm registry with package scripts disabled; compare every downloaded package integrity against package-lock.json before extracting. Preserve other dependencies through symlinks. Link only the clean archived build directory to the overlay. Do not replace repository node_modules, edit the lockfile, bypass type validation or copy credentials into the build.

All 143 restored package integrities matched. Direct strict production TypeScript completed in 23.31 seconds; the same source then passed npm run build, including Next production types and static generation, with synthetic settings and no real credentials supplied. Exact source/archive/package evidence is in locked-sdk-build-recovery.json. Prior stalled attempts are retained as history. This is local build recovery, not a deployment or a general performance benchmark.

For future builds, keep dependency file data fully available locally. Do not move the user's project or change sync/security settings automatically. Temporary paths are recovery evidence, not durable dependency distribution.
