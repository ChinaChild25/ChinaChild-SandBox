-- Постоянная ссылка на онлайн-урок (Zoom, VooV и т.д.) для преподавателя.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS online_meeting_url text;

COMMENT ON COLUMN public.profiles.online_meeting_url IS 'Персональная ссылка на видеозвонок; видна ученику с закреплённым преподавателем.';
