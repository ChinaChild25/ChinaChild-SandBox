-- Fix: soft-delete must not violate messages_content_or_media_required.

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_or_media_required;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_or_media_required
  CHECK (
    deleted_at IS NOT NULL
    OR (content IS NOT NULL AND btrim(content) <> '')
    OR media_url IS NOT NULL
  );

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
      content = '[deleted]'
  WHERE m.id = p_message_id
    AND m.sender_id = auth.uid()
    AND m.deleted_at IS NULL
    AND public.auth_is_participant_of_conversation(m.conversation_id);

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_message(uuid) TO authenticated;
