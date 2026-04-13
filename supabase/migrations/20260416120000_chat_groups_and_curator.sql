-- Chat model upgrade: direct/group chats, curator role, participant management.

-- 1) profiles.role supports student / teacher / curator
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'curator'));

-- 2) conversations metadata
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS title text NULL;

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_type_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_type_check
  CHECK (type IN ('direct', 'group'));

-- 3) conversation_participants metadata
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS added_by uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL;

-- 4) role helper
CREATE OR REPLACE FUNCTION public.auth_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role FROM public.profiles p WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.auth_current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_current_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_is_curator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_current_role() = 'curator';
$$;

REVOKE ALL ON FUNCTION public.auth_is_curator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_curator() TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_can_manage_group_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND c.type = 'group'
      AND (
        public.auth_is_curator()
        OR c.created_by = auth.uid()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_can_manage_group_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can_manage_group_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_can_teacher_manage_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    JOIN public.profiles st ON st.id = p_student_id
    WHERE me.id = auth.uid()
      AND me.role = 'teacher'
      AND st.role = 'student'
      AND st.assigned_teacher_id = me.id
  );
$$;

REVOKE ALL ON FUNCTION public.auth_can_teacher_manage_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can_teacher_manage_student(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_can_add_user_to_group(p_conversation_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.profiles u ON u.id = p_user_id
    WHERE c.id = p_conversation_id
      AND c.type = 'group'
      AND (
        public.auth_is_curator()
        OR (
          c.created_by = auth.uid()
          AND (
            u.role <> 'student'
            OR public.auth_can_teacher_manage_student(p_user_id)
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_can_add_user_to_group(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can_add_user_to_group(uuid, uuid) TO authenticated;

-- 5) update direct chat RPC to respect type='direct'
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_peer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_peer_id IS NULL OR p_peer_id = me THEN
    RAISE EXCEPTION 'invalid peer';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(me::text, p_peer_id::text)),
    hashtext(GREATEST(me::text, p_peer_id::text))
  );

  SELECT c.id INTO v_conv
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND (SELECT count(*)::int FROM public.conversation_participants p WHERE p.conversation_id = c.id) = 2
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants p1
      WHERE p1.conversation_id = c.id AND p1.user_id = me
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants p2
      WHERE p2.conversation_id = c.id AND p2.user_id = p_peer_id
    )
  ORDER BY (
    SELECT max(m.created_at) FROM public.messages m WHERE m.conversation_id = c.id
  ) DESC NULLS LAST,
  c.created_at DESC
  LIMIT 1;

  IF v_conv IS NOT NULL THEN
    RETURN v_conv;
  END IF;

  INSERT INTO public.conversations (created_by, type, title) VALUES (me, 'direct', NULL) RETURNING id INTO v_conv;

  INSERT INTO public.conversation_participants (conversation_id, user_id, added_by) VALUES
    (v_conv, me, me),
    (v_conv, p_peer_id, me);

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;

-- 6) group chat management RPCs
CREATE OR REPLACE FUNCTION public.create_group_conversation(
  p_title text,
  p_student_ids uuid[],
  p_curator_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  me_role text;
  v_conv uuid;
  sid uuid;
  cid uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO me_role FROM public.profiles WHERE id = me;
  IF me_role NOT IN ('teacher', 'curator') THEN
    RAISE EXCEPTION 'insufficient permissions';
  END IF;

  INSERT INTO public.conversations (created_by, type, title)
  VALUES (me, 'group', NULLIF(btrim(p_title), ''))
  RETURNING id INTO v_conv;

  INSERT INTO public.conversation_participants (conversation_id, user_id, added_by)
  VALUES (v_conv, me, me)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  FOREACH sid IN ARRAY COALESCE(p_student_ids, ARRAY[]::uuid[]) LOOP
    IF me_role = 'teacher' AND NOT public.auth_can_teacher_manage_student(sid) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.conversation_participants (conversation_id, user_id, added_by)
    VALUES (v_conv, sid, me)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  IF me_role = 'curator' THEN
    FOREACH cid IN ARRAY COALESCE(p_curator_ids, ARRAY[]::uuid[]) LOOP
      INSERT INTO public.conversation_participants (conversation_id, user_id, added_by)
      VALUES (v_conv, cid, me)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_conversation(text, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[], uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_participants_to_group_conversation(
  p_conversation_id uuid,
  p_user_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  me_role text;
  uid uuid;
  inserted_count int := 0;
  row_count int := 0;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO me_role FROM public.profiles WHERE id = me;
  IF me_role NOT IN ('teacher', 'curator') THEN
    RAISE EXCEPTION 'insufficient permissions';
  END IF;
  IF NOT public.auth_can_manage_group_conversation(p_conversation_id) THEN
    RAISE EXCEPTION 'cannot manage this conversation';
  END IF;

  FOREACH uid IN ARRAY COALESCE(p_user_ids, ARRAY[]::uuid[]) LOOP
    IF me_role = 'teacher' AND NOT public.auth_can_add_user_to_group(p_conversation_id, uid) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.conversation_participants (conversation_id, user_id, added_by)
    VALUES (p_conversation_id, uid, me)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    inserted_count := inserted_count + row_count;
  END LOOP;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.add_participants_to_group_conversation(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_participants_to_group_conversation(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_participant_from_group_conversation(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  me_role text;
  target_role text;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT role INTO me_role FROM public.profiles WHERE id = me;
  IF me_role NOT IN ('teacher', 'curator') THEN
    RAISE EXCEPTION 'insufficient permissions';
  END IF;
  IF NOT public.auth_can_manage_group_conversation(p_conversation_id) THEN
    RAISE EXCEPTION 'cannot manage this conversation';
  END IF;
  IF p_user_id = me THEN
    RAISE EXCEPTION 'cannot remove self';
  END IF;

  SELECT role INTO target_role FROM public.profiles WHERE id = p_user_id;
  IF me_role = 'teacher' AND target_role = 'student' AND NOT public.auth_can_teacher_manage_student(p_user_id) THEN
    RAISE EXCEPTION 'teacher can remove only assigned students';
  END IF;

  DELETE FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_participant_from_group_conversation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_participant_from_group_conversation(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rename_group_conversation(
  p_conversation_id uuid,
  p_title text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.auth_can_manage_group_conversation(p_conversation_id) THEN
    RAISE EXCEPTION 'cannot manage this conversation';
  END IF;

  UPDATE public.conversations
  SET title = NULLIF(btrim(p_title), '')
  WHERE id = p_conversation_id
    AND type = 'group';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_group_conversation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_group_conversation(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.move_student_to_another_group_conversation(
  p_student_id uuid,
  p_from_conversation_id uuid,
  p_to_conversation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.auth_is_curator() THEN
    RAISE EXCEPTION 'curator only';
  END IF;

  PERFORM public.remove_participant_from_group_conversation(p_from_conversation_id, p_student_id);
  PERFORM public.add_participants_to_group_conversation(p_to_conversation_id, ARRAY[p_student_id]::uuid[]);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.move_student_to_another_group_conversation(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_student_to_another_group_conversation(uuid, uuid, uuid) TO authenticated;

-- 7) RLS refresh for participants insert/delete and conversation update
DROP POLICY IF EXISTS "conversation_participants_insert_by_creator" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert_managed_group"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_conversation_created_by_current_user(conversation_id)
    OR public.auth_can_add_user_to_group(conversation_id, user_id)
  );

DROP POLICY IF EXISTS "conversation_participants_delete_manage_group" ON public.conversation_participants;
CREATE POLICY "conversation_participants_delete_manage_group"
  ON public.conversation_participants
  FOR DELETE
  TO authenticated
  USING (
    public.auth_can_manage_group_conversation(conversation_id)
    OR public.auth_is_curator()
  );

DROP POLICY IF EXISTS "conversations_update_group_title" ON public.conversations;
CREATE POLICY "conversations_update_group_title"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (public.auth_can_manage_group_conversation(id))
  WITH CHECK (public.auth_can_manage_group_conversation(id));

GRANT UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT UPDATE ON public.conversations TO authenticated;
