-- Persist per-user UI accent and expose it in chat peer projection.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_accent text NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_ui_accent_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ui_accent_check
  CHECK (ui_accent IS NULL OR ui_accent IN ('sage', 'pink', 'blue', 'orange'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'profiles'
      AND c.column_name = 'timezone'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE VIEW public.chat_peer_profiles AS
      SELECT p.id, p.first_name, p.last_name, p.timezone, p.role, p.avatar_url, p.ui_accent
      FROM public.profiles p
    ';
  ELSE
    EXECUTE '
      CREATE OR REPLACE VIEW public.chat_peer_profiles AS
      SELECT p.id, p.first_name, p.last_name, NULL::text AS timezone, p.role, p.avatar_url, p.ui_accent
      FROM public.profiles p
    ';
  END IF;
END $$;

GRANT SELECT ON public.chat_peer_profiles TO authenticated;
