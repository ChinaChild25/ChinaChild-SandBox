-- Один личный диалог на пару пользователей: клиентский find + insert даёт дубли при гонке
-- (двойной клик «Новый диалог» / две кнопки) или при повторном вызове до коммита первого.

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
  WHERE (SELECT count(*)::int FROM public.conversation_participants p WHERE p.conversation_id = c.id) = 2
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

  INSERT INTO public.conversations (created_by) VALUES (me) RETURNING id INTO v_conv;

  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES
    (v_conv, me),
    (v_conv, p_peer_id);

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation(uuid) TO authenticated;
