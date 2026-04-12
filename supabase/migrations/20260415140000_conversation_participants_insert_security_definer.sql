-- INSERT в conversation_participants проверяет conversations через EXISTS под RLS.
-- Если SELECT по conversations для создателя ещё недоступен (нет строки в participants),
-- WITH CHECK падает — «new row violates row-level security policy for conversation_participants».
-- Проверка «создатель беседы» вынесена в SECURITY DEFINER (чтение conversations без RLS).

CREATE OR REPLACE FUNCTION public.is_conversation_created_by_current_user(p_conversation_id uuid)
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
      AND c.created_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_conversation_created_by_current_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_created_by_current_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "conversation_participants_insert_by_creator" ON public.conversation_participants;

CREATE POLICY "conversation_participants_insert_by_creator"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_conversation_created_by_current_user(conversation_id));
