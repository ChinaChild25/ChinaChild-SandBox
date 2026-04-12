-- Подзапросы EXISTS к conversation_participants внутри политик messages / participants / conversations
-- выполняются снова под RLS и у второго участника (ученика) могут не «видеть» свою строку —
-- список чатов или сообщения пустые, хотя участник в таблице есть.

CREATE OR REPLACE FUNCTION public.auth_is_participant_of_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_participant_of_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_participant_of_conversation(uuid) TO authenticated;

DROP POLICY IF EXISTS "conversation_participants_select_member" ON public.conversation_participants;

CREATE POLICY "conversation_participants_select_member"
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (public.auth_is_participant_of_conversation(conversation_id));

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;

CREATE POLICY "messages_select_participant"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.auth_is_participant_of_conversation(conversation_id));

DROP POLICY IF EXISTS "messages_insert_participant_sender" ON public.messages;

CREATE POLICY "messages_insert_participant_sender"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.auth_is_participant_of_conversation(conversation_id)
  );

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
DROP POLICY IF EXISTS "view own conversations" ON public.conversations;

CREATE POLICY "conversations_select_member_or_creator"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.auth_is_participant_of_conversation(id)
  );
