-- Текстовый чат (этап 1): conversations, participants, messages + RLS.
-- Создатель диалога (created_by) добавляет участников; посторонние не могут вставить себя по UUID.

-- ── Таблицы ───────────────────────────────────────────────────────────────
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx
  ON public.conversation_participants (user_id);

CREATE INDEX IF NOT EXISTS conversation_participants_conversation_id_idx
  ON public.conversation_participants (conversation_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_body_nonempty CHECK (btrim(body) <> ''),
  CONSTRAINT messages_body_max CHECK (char_length(body) <= 10000)
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_at_idx
  ON public.messages (conversation_id, created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id
        AND cp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "conversations_insert_creator" ON public.conversations;
CREATE POLICY "conversations_insert_creator"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "conversation_participants_select_member" ON public.conversation_participants;
CREATE POLICY "conversation_participants_select_member"
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = (SELECT auth.uid())
    )
  );

-- Только создатель беседы может добавлять строки участников (себя и второго пользователя).
DROP POLICY IF EXISTS "conversation_participants_insert_by_creator" ON public.conversation_participants;
CREATE POLICY "conversation_participants_insert_by_creator"
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND c.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_participant_sender" ON public.messages;
CREATE POLICY "messages_insert_participant_sender"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = (SELECT auth.uid())
    )
  );

-- Просмотр профиля собеседника по общей беседе (имя, роль, аватар в списке чатов).
DROP POLICY IF EXISTS "profiles_select_conversation_peer" ON public.profiles;
CREATE POLICY "profiles_select_conversation_peer"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants cp_self
      INNER JOIN public.conversation_participants cp_peer
        ON cp_self.conversation_id = cp_peer.conversation_id
      WHERE cp_self.user_id = (SELECT auth.uid())
        AND cp_peer.user_id = profiles.id
    )
  );

-- ── Grants ────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT ON public.conversations TO authenticated;
GRANT SELECT, INSERT ON public.conversation_participants TO authenticated;
GRANT SELECT, INSERT ON public.messages TO authenticated;
