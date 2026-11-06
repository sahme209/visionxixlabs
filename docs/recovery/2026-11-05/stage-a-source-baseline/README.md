# Preserved StageA source baseline

Reviewed code17bf3ff7 plus the authoritative working master and matching four generated views are preserved in isolated local source commit e6f4ebf1c9a38b25ffb3d0c70aa0ea372132904a, ref codex/stage-a-source-17bf3ff7-f5f1678c. Main checkout, logical staged contents and the user’s20-line working master diff were verified unchanged. Current master SHA256 isf5f1678c58e6bd89246a0a04e900ab524bdeb09aa1b6d46333db6b1af6dcdc92; its bytes/diff are separately preserved in the local recovery directory.

The verified local stage-a-source-e6f4ebf1.bundle contains both main17bf and this isolated source ref over4686b72c. No remote push, build or execution occurred. This resolves the source consistency issue where generated views stamped working master bytes that were intentionally not staged in the main checkout. User additions are attributed as user requirements, not product acceptance.

This is a BASELINE, not the final StageA execution source. New reviewed Git-scratch/orchestration/provenance code must first be committed and a fresh isolated source snapshot frozen before requesting/using an actual StageA bundle. No branch overwrite, source mutation, extra build permission or installation follows from this record.
