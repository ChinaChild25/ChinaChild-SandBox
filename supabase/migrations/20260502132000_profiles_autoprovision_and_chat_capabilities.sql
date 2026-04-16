-- Stabilization: guaranteed public.profiles provisioning + explicit chat capabilities contract.

-- 1) Ensure profile row is created for every auth user.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_first_name text;
  v_last_name text;
BEGIN
  v_full_name := NULLIF(trim(COALESCE(new.raw_user_meta_data->>'full_name', '')), '');
  IF v_full_name IS NULL THEN
    v_full_name := split_part(COALESCE(new.email, 'Пользователь'), '@', 1);
  END IF;

  v_first_name := split_part(v_full_name, ' ', 1);
  v_last_name := NULLIF(trim(substring(v_full_name from length(v_first_name) + 2)), '');

  INSERT INTO public.profiles (id, role, full_name, first_name, last_name)
  VALUES (new.id, 'student', v_full_name, NULLIF(v_first_name, ''), v_last_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user_profile();

-- Backfill missing profiles for already-created auth users.
INSERT INTO public.profiles (id, role, full_name, first_name, last_name)
SELECT
  u.id,
  'student',
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(u.email, 'Пользователь'), '@', 1)) AS full_name,
  NULLIF(split_part(COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(u.email, 'Пользователь'), '@', 1)), ' ', 1), '') AS first_name,
  NULLIF(
    trim(
      substring(
        COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(u.email, 'Пользователь'), '@', 1))
        from length(split_part(COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(u.email, 'Пользователь'), '@', 1)), ' ', 1)) + 2
      )
    ),
    ''
  ) AS last_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 2) Chat capabilities contract for client gating.
CREATE OR REPLACE FUNCTION public.get_chat_capabilities()
RETURNS TABLE (
  has_chat_peer_profiles boolean,
  has_messages_media boolean,
  has_messages_edit_delete boolean,
  has_message_reads boolean,
  has_presence_typing boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM information_schema.views v
      WHERE v.table_schema = 'public'
        AND v.table_name = 'chat_peer_profiles'
    ) AS has_chat_peer_profiles,
    EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'messages'
        AND c.column_name = 'media_url'
    ) AS has_messages_media,
    EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'messages'
        AND c.column_name = 'edited_at'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'messages'
        AND c.column_name = 'deleted_at'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'edit_message'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'soft_delete_message'
    ) AS has_messages_edit_delete,
    EXISTS (
      SELECT 1
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name = 'message_reads'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'mark_conversation_read'
    ) AS has_message_reads,
    EXISTS (
      SELECT 1
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name = 'user_presence'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name = 'typing_indicators'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'upsert_presence'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'set_typing'
    ) AS has_presence_typing;
$$;

REVOKE ALL ON FUNCTION public.get_chat_capabilities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_capabilities() TO authenticated;
