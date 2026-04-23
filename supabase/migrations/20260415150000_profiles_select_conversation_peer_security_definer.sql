-- Политика profiles_select_conversation_peer читает conversation_participants под RLS.
-- Пока участники только что созданы, подзапрос может не «видеть» пару строк — профиль
-- собеседника не отдаётся, в UI остаётся имя «User» и нет аватара.

CREATE OR REPLACE FUNCTION public.is_profile_chat_peer_of_current_user(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp_self
    INNER JOIN public.conversation_participants cp_peer
      ON cp_self.conversation_id = cp_peer.conversation_id
    WHERE cp_self.user_id = auth.uid()
      AND cp_peer.user_id = p_profile_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_profile_chat_peer_of_current_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_profile_chat_peer_of_current_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles_select_conversation_peer" ON public.profiles;

CREATE POLICY "profiles_select_conversation_peer"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_profile_chat_peer_of_current_user(id));
