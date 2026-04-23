-- Chat hardening:
-- 1) first-class forwarded metadata (instead of text marker-only)
-- 2) cleanup historical duplicate direct conversations
-- 3) enforce uniqueness for direct pairs at DB level

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_forwarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_forwarded_from_message_id_idx
  ON public.messages (forwarded_from_message_id);

-- Backfill: old client marked forwarded messages with [[forwarded]] prefix in content.
UPDATE public.messages
SET is_forwarded = true
WHERE is_forwarded = false
  AND content LIKE '[[forwarded]]%';

-- Make direct lookup stricter: exactly two participants.
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

  IF v_caller_role = 'student' THEN
    SELECT c.id INTO v_conv_id
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

    IF v_conv_id IS NULL THEN
      RAISE EXCEPTION 'students cannot initiate new conversations' USING ERRCODE = '42501';
    END IF;

    RETURN v_conv_id;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(LEAST(me::text, p_peer_id::text)),
    hashtext(GREATEST(me::text, p_peer_id::text))
  );

  SELECT c.id INTO v_conv_id
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

-- Cleanup legacy duplicate direct chats by pair.
DO $$
BEGIN
  CREATE TEMP TABLE _chat_direct_duplicates ON COMMIT DROP AS
  WITH direct_pairs AS (
    SELECT
      c.id AS conversation_id,
      (array_agg(cp.user_id ORDER BY cp.user_id))[1] AS user_a,
      (array_agg(cp.user_id ORDER BY cp.user_id))[2] AS user_b,
      c.created_at,
      (
        SELECT max(m.created_at)
        FROM public.messages m
        WHERE m.conversation_id = c.id
      ) AS last_message_at
    FROM public.conversations c
    JOIN public.conversation_participants cp
      ON cp.conversation_id = c.id
    WHERE c.type = 'direct'
    GROUP BY c.id, c.created_at
    HAVING count(*) = 2
  ),
  ranked AS (
    SELECT
      dp.*,
      first_value(dp.conversation_id) OVER (
        PARTITION BY dp.user_a, dp.user_b
        ORDER BY dp.last_message_at DESC NULLS LAST, dp.created_at DESC, dp.conversation_id
      ) AS keep_id,
      row_number() OVER (
        PARTITION BY dp.user_a, dp.user_b
        ORDER BY dp.last_message_at DESC NULLS LAST, dp.created_at DESC, dp.conversation_id
      ) AS rn
    FROM direct_pairs dp
  )
  SELECT conversation_id AS drop_id, keep_id
  FROM ranked
  WHERE rn > 1;

  -- typing_indicators has PK (conversation_id,user_id), so merge via upsert before deleting.
  INSERT INTO public.typing_indicators (conversation_id, user_id, updated_at)
  SELECT d.keep_id, t.user_id, max(t.updated_at)
  FROM _chat_direct_duplicates d
  JOIN public.typing_indicators t
    ON t.conversation_id = d.drop_id
  GROUP BY d.keep_id, t.user_id
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET updated_at = GREATEST(public.typing_indicators.updated_at, EXCLUDED.updated_at);

  DELETE FROM public.typing_indicators t
  USING _chat_direct_duplicates d
  WHERE t.conversation_id = d.drop_id;

  UPDATE public.messages m
  SET conversation_id = d.keep_id
  FROM _chat_direct_duplicates d
  WHERE m.conversation_id = d.drop_id;

  DELETE FROM public.conversations c
  USING _chat_direct_duplicates d
  WHERE c.id = d.drop_id;
END $$;

-- Constraint trigger: prevent creating another direct chat for the same pair.
CREATE OR REPLACE FUNCTION public.ensure_unique_direct_pair()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid := COALESCE(NEW.conversation_id, OLD.conversation_id);
  v_type text;
  v_pair uuid[];
BEGIN
  SELECT c.type INTO v_type
  FROM public.conversations c
  WHERE c.id = v_conversation_id;

  IF v_type IS DISTINCT FROM 'direct' THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(cp.user_id ORDER BY cp.user_id)
  INTO v_pair
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = v_conversation_id;

  -- Not ready yet (e.g. first participant only)
  IF v_pair IS NULL OR array_length(v_pair, 1) <> 2 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.conversation_participants cp
      ON cp.conversation_id = c.id
    WHERE c.type = 'direct'
      AND c.id <> v_conversation_id
    GROUP BY c.id
    HAVING count(*) = 2
       AND array_agg(cp.user_id ORDER BY cp.user_id) = v_pair
  ) THEN
    RAISE EXCEPTION 'duplicate direct conversation for participant pair' USING ERRCODE = '23505';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ensure_unique_direct_pair_trigger ON public.conversation_participants;
CREATE CONSTRAINT TRIGGER ensure_unique_direct_pair_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.conversation_participants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.ensure_unique_direct_pair();
