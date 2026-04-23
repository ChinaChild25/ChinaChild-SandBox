-- Создатель может SELECT свою строку сразу после INSERT, до вставки участников
-- (PostgREST / supabase-js возвращает строку после insert).

DROP POLICY IF EXISTS "view own conversations" ON public.conversations;

CREATE POLICY "view own conversations"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = auth.uid()
    )
  );
