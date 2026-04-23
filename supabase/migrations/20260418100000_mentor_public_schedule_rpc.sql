-- Публичное расписание для страниц /mentors/[slug]: шаблон из teacher_schedule_templates,
-- без открытого SELECT по profiles для anon (только RPC).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mentor_page_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_mentor_page_slug_uidx
  ON public.profiles (mentor_page_slug)
  WHERE mentor_page_slug IS NOT NULL;

COMMENT ON COLUMN public.profiles.mentor_page_slug IS
  'Совпадает со slug в URL (/mentors/zhao-li). Заполнить вручную для преподавателя/куратора, чей шаблон показываем на публичной странице.';

CREATE OR REPLACE FUNCTION public.get_mentor_public_schedule(p_slug text)
RETURNS TABLE (weekly_template jsonb, timezone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tst.weekly_template, tst.timezone
  FROM public.teacher_schedule_templates tst
  INNER JOIN public.profiles p ON p.id = tst.teacher_id
  WHERE p.mentor_page_slug = btrim(p_slug)
    AND btrim(p_slug) <> ''
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_mentor_public_schedule(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mentor_public_schedule(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_mentor_public_schedule(text) TO authenticated;
