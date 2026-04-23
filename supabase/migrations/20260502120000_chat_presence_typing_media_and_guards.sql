-- Chat v1.0: media attachments, presence, typing, strict direct-init guard, safe peer profile view.

-- 1) Extend messages with media/reply columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS media_size integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid DEFAULT NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'messages'
      AND tc.constraint_name = 'messages_content_or_media_required'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_content_or_media_required
      CHECK (
        (content IS NOT NULL AND btrim(content) <> '')
        OR media_url IS NOT NULL
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'messages'
      AND tc.constraint_name = 'messages_media_size_nonnegative'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_media_size_nonnegative
      CHECK (media_size IS NULL OR media_size >= 0);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'messages'
      AND tc.constraint_name = 'messages_media_type_check'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_media_type_check
      CHECK (
        media_type IS NULL
        OR media_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
      );
  END IF;
END
$$;

-- 2) Presence table
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_presence_status_check CHECK (status IN ('online', 'offline'))
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence_select_conversation_peer" ON public.user_presence;
CREATE POLICY "presence_select_conversation_peer"
  ON public.user_presence
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid()
        AND cp2.user_id = user_presence.user_id
    )
  );

DROP POLICY IF EXISTS "presence_update_own" ON public.user_presence;
CREATE POLICY "presence_update_own"
  ON public.user_presence
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "presence_insert_own" ON public.user_presence;
CREATE POLICY "presence_insert_own"
  ON public.user_presence
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;

-- 3) Typing indicators table
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "typing_select_participant" ON public.typing_indicators;
CREATE POLICY "typing_select_participant"
  ON public.typing_indicators
  FOR SELECT
  TO authenticated
  USING (public.auth_is_participant_of_conversation(conversation_id));

DROP POLICY IF EXISTS "typing_upsert_own" ON public.typing_indicators;
CREATE POLICY "typing_upsert_own"
  ON public.typing_indicators
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.auth_is_participant_of_conversation(conversation_id)
  );

DROP POLICY IF EXISTS "typing_update_own" ON public.typing_indicators;
CREATE POLICY "typing_update_own"
  ON public.typing_indicators
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "typing_delete_own" ON public.typing_indicators;
CREATE POLICY "typing_delete_own"
  ON public.typing_indicators
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.typing_indicators TO authenticated;

-- 3.1) Message read receipts
CREATE TABLE IF NOT EXISTS public.message_reads (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reads_select_participant" ON public.message_reads;
CREATE POLICY "message_reads_select_participant"
  ON public.message_reads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_reads.message_id
        AND public.auth_is_participant_of_conversation(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "message_reads_insert_own" ON public.message_reads;
CREATE POLICY "message_reads_insert_own"
  ON public.message_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_reads.message_id
        AND m.sender_id <> auth.uid()
        AND public.auth_is_participant_of_conversation(m.conversation_id)
    )
  );

GRANT SELECT, INSERT ON public.message_reads TO authenticated;

-- 4) Storage bucket and storage policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
CREATE POLICY "chat_media_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.auth_is_participant_of_conversation((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "chat_media_select" ON storage.objects;
CREATE POLICY "chat_media_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND public.auth_is_participant_of_conversation((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "chat_media_delete_own" ON storage.objects;
CREATE POLICY "chat_media_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- 5) Direct conversation RPC with role guard
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(p_peer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  v_caller_role text;
  v_conv_id uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_peer_id IS NULL OR p_peer_id = me THEN
    RAISE EXCEPTION 'cannot start conversation with yourself' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = me;

  -- Student can only open existing direct, but cannot create a new one.
  IF v_caller_role = 'student' THEN
    SELECT c.id INTO v_conv_id
    FROM public.conversations c
    WHERE c.type = 'direct'
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

    IF v_conv_id IS NULL THEN
      RAISE EXCEPTION 'students cannot initiate new conversations' USING ERRCODE = '42501';
    END IF;

    RETURN v_conv_id;
  END IF;

  -- Teacher / curator create-or-get behavior with advisory lock for idempotency.
  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(me::text, p_peer_id::text)),
    hashtext(GREATEST(me::text, p_peer_id::text))
  );

  SELECT c.id INTO v_conv_id
  FROM public.conversations c
  WHERE c.type = 'direct'
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

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  INSERT INTO public.conversations (created_by, type, title)
  VALUES (me, 'direct', NULL)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id, added_by)
  VALUES
    (v_conv_id, me, me),
    (v_conv_id, p_peer_id, me);

  RETURN v_conv_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;

-- 6) Presence & typing RPC
CREATE OR REPLACE FUNCTION public.upsert_presence(p_status text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_presence (user_id, status, last_seen_at)
  VALUES (
    auth.uid(),
    CASE WHEN p_status = 'online' THEN 'online' ELSE 'offline' END,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    last_seen_at = now();
$$;

REVOKE ALL ON FUNCTION public.upsert_presence(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_presence(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_typing(
  p_conversation_id uuid,
  p_is_typing boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.auth_is_participant_of_conversation(p_conversation_id) THEN
    RAISE EXCEPTION 'not a participant' USING ERRCODE = '42501';
  END IF;

  IF p_is_typing THEN
    INSERT INTO public.typing_indicators (conversation_id, user_id, updated_at)
    VALUES (p_conversation_id, auth.uid(), now())
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET updated_at = now();
  ELSE
    DELETE FROM public.typing_indicators
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_typing(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_typing(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.edit_message(
  p_message_id uuid,
  p_content text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.messages m
  SET content = btrim(p_content),
      edited_at = now()
  WHERE m.id = p_message_id
    AND m.sender_id = auth.uid()
    AND m.deleted_at IS NULL
    AND public.auth_is_participant_of_conversation(m.conversation_id)
    AND btrim(p_content) <> '';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_message(
  p_message_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  UPDATE public.messages m
  SET deleted_at = now(),
      deleted_by = auth.uid(),
      content = ''
  WHERE m.id = p_message_id
    AND m.sender_id = auth.uid()
    AND m.deleted_at IS NULL
    AND public.auth_is_participant_of_conversation(m.conversation_id);

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.auth_is_participant_of_conversation(p_conversation_id) THEN
    RAISE EXCEPTION 'not a participant' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.message_reads (message_id, user_id, read_at)
  SELECT m.id, auth.uid(), now()
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> auth.uid()
    AND m.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.message_reads mr
      WHERE mr.message_id = m.id
        AND mr.user_id = auth.uid()
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- 7) Strict chat peer projection
DROP POLICY IF EXISTS "profiles_teacher_select_students" ON public.profiles;
DROP POLICY IF EXISTS "profiles_teacher_select_own_students" ON public.profiles;
CREATE OR REPLACE FUNCTION public.is_current_user_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'teacher'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_teacher() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_teacher() TO authenticated;

CREATE POLICY "profiles_teacher_select_own_students"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_teacher()
    AND role = 'student'
    AND assigned_teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "profiles_select_conversation_peer" ON public.profiles;
CREATE POLICY "profiles_select_conversation_peer"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid()
        AND cp2.user_id = profiles.id
    )
  );

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
      SELECT p.id, p.first_name, p.last_name, p.timezone, p.role, p.avatar_url
      FROM public.profiles p
    ';
  ELSE
    EXECUTE '
      CREATE OR REPLACE VIEW public.chat_peer_profiles AS
      SELECT p.id, p.first_name, p.last_name, NULL::text AS timezone, p.role, p.avatar_url
      FROM public.profiles p
    ';
  END IF;
END $$;

GRANT SELECT ON public.chat_peer_profiles TO authenticated;

-- 8) Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'typing_indicators'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
  END IF;
END $$;
