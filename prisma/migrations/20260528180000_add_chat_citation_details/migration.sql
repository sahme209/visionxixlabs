-- Phase 530 — Persist rich citationDetails on each chat turn so
-- history rehydrates with the same deep-links the ephemeral response
-- showed.

ALTER TABLE "AiMemoryChatTurn"
ADD COLUMN "citationDetailsJson" JSONB;
