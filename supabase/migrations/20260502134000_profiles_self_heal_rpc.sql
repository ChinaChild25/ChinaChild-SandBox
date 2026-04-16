-- Emergency-stable profile provisioning RPC for authenticated users.
-- Allows deterministic self-heal even if client-side INSERT is blocked by RLS.

CREATE OR REPLACE FUNCTION public.ensure_profile_for_current_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_first_name text;
  v_last_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid) THEN
    RETURN v_uid;
  END IF;

  SELECT
    u.email,
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'full_name', '')), '')
  INTO v_email, v_full_name
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_full_name IS NULL THEN
    v_full_name := split_part(COALESCE(v_email, 'Пользователь'), '@', 1);
  END IF;

  v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
  v_last_name := NULLIF(trim(substring(v_full_name from length(COALESCE(v_first_name, '')) + 2)), '');

  INSERT INTO public.profiles (id, role, full_name, first_name, last_name)
  VALUES (v_uid, 'student', v_full_name, v_first_name, v_last_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile_for_current_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile_for_current_user() TO authenticated;
