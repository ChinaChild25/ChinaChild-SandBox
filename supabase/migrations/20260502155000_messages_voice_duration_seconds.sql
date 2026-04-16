-- Stable waveform progress: persist known audio duration per message.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_duration_sec integer NULL;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_media_duration_sec_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_media_duration_sec_check
  CHECK (media_duration_sec IS NULL OR media_duration_sec > 0);
