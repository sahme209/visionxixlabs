# Three approved AWS public reads — consumed

Owner approved exactly three official documentation pages on November13. All three were read; no linked page was followed, and no account, credential, API operation, installation or spending occurred. Current installed SDK field shapes were inspected separately as local source, not cloud evidence.

## Verified contracts and limits

1. [Task metadata v4 response](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-metadata-endpoint-v4-response.html) describes TaskARN, task family/revision, status, launch type and per-container ImageID (image-manifest digest). Some fields are conditional. ExecutionStoppedAt describes transition to desired STOPPED; it does not state that every credential expired. The documented payload contains no whole-process signature or trusted-current-time proof. Metadata therefore supplies candidate observations to compare with independently obtained native control-plane records; its values are not an authority grant.

2. [Fargate task parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html) supports read-only root filesystems for Linux, explicit non-root users and dropping ALL capabilities. Root-filesystem read-only defaults false; omitted settings cannot count as hardening. awsvpc is required. The proposed CPU/memory pairs appear in its supported table. These configuration semantics do not establish actual running protection or credential custody. We have not assumed a configurable no-new-privileges guarantee, image signature, admission API or process attestation.

3. [ECS Exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html) runs commands as root even when the container specifies a different user and requires writable filesystem paths; read-only rootfs is unsupported for Exec. Separate SSM sessions can bypass normal Exec logging. The candidate must disable Exec and exclude session capabilities, rather than turn them on for convenient testing. This is a design requirement; no actual account policy or running task was inspected.

## Decisions that follow

Retain the Linux-only, immutable/non-root/read-only-root/capability-dropped candidate, but verify actual runtime behavior before constructing a qualified supplier. Keep the role-free initial diagnostic separate from later source/target credential and human/provider trials. Do not put the fixture database in a sidecar sharing issuer task-role capability. Keep current closure/trusted-clock/refusal semantics and Mac qualification unchanged.

The pages do not establish the remaining actual origin/observer channel, trusted current-clock interval, complete native credential cutoff or real same-consumer execution. No normally-six-hour value is converted into a universal maximum. An unqualified observation stays unqualified, even if every requested field matches.
