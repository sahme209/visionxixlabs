# Independent review — bounded host packet scope

Verdict: ready after ONE narrow scope correction below. File-only review; no public/account/console/provider/native operation, code or execution.

The combined decision is coherent: choose the isolated operational AWS/Linux model and prepare one complete exact setup/cost/cleanup manifest. Six official public references and at most six logical same-account/us-east-2 read-only console operations are finite; existing authentication refusals are not retried and wrong session/account stops. It explicitly preserves strict production assurance/disabled Governance and does not claim G3 completion, grant resources or ask for an invented numeric time bound.

## Required correction before approval

Remove “inspect image/storage/delivery metadata needed for bounded quantities” from the AWS console scope. It could cover customer S3/ECR/EBS inventories or object/image content despite the general no-customer-data sentence. None is needed merely to propose a delivery route/quantity ceiling. Replace it with: “No bucket, registry repository, stored image, volume, snapshot, object, artifact content or customer-storage discovery. Delivery/artifact/evidence quantities not already known use explicit proposed caps and retention assumptions, not a discovered customer inventory.” An unused sixth logical operation need not be filled.

Also keep the other reads tied to exact known coordinates: only the previously verified test account/region/default VPC and selected subnet/route from saved evidence, and one officially published AWS x86_64 AMI candidate identified by the approved public references. No listing privately owned AMIs, unrelated networks/regions or existing application resources. Metadata cannot establish actual future capacity; retain uncertainty rather than treating an offering/quota screen as a provisioning guarantee. These are clarifications of the stated scope, not extra reads.

Public references should close only the selected support/image/required delivery and currently missing price dimensions; reuse saved Ohio compute/IP/gp3/transfer facts and do not open another source-release or pricing survey. Official search locates those references, not a new broad external-read allowance.

After the correction, this is ready for the ONE owner preparation decision. The result is a proposed complete manifest/quote, with bounds clearly distinguished from measured bytes/current prices and all residual exposure stated. No actual runtime/installation/IAM/provider effect/database/spending/production permission follows; exact later effect approval waits for independent manifest review. No raw-worker diagnostics or dormant-wrapper implementation is implied.


Root applied the sole requested tightening before any question/read: removed storage/delivery inspection, narrowed to one official public AMI and the saved default-VPC/selected subnet/route, expressly banned customer-storage/private-image/unrelated inventory, and retained unused-call limits. File-only assertions verified this exact delta; no operations occurred.
