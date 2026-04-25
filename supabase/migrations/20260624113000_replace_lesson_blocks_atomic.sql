CREATE OR REPLACE FUNCTION public.replace_lesson_blocks_atomic(
  p_lesson_id uuid,
  p_blocks jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_blocks IS NULL OR jsonb_typeof(p_blocks) <> 'array' THEN
    RAISE EXCEPTION 'Blocks payload must be a JSON array';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.lessons l
    JOIN public.courses c ON c.id = l.course_id
    WHERE l.id = p_lesson_id
      AND c.is_custom = true
      AND c.teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.lesson_blocks
  WHERE lesson_id = p_lesson_id;

  INSERT INTO public.lesson_blocks (lesson_id, type, "order", data)
  SELECT
    p_lesson_id,
    trim(COALESCE(item.value->>'type', '')),
    item.ordinality::integer - 1,
    COALESCE(item.value->'data', '{}'::jsonb)
  FROM jsonb_array_elements(p_blocks) WITH ORDINALITY AS item(value, ordinality);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_lesson_blocks_atomic(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_lesson_blocks_atomic(uuid, jsonb) TO authenticated;
