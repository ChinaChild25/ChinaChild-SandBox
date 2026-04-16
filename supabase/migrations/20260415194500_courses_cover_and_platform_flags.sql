-- Visual metadata for mixed courses grid: platform vs teacher covers.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS cover_color text NULL,
  ADD COLUMN IF NOT EXISTS cover_style text NULL,
  ADD COLUMN IF NOT EXISTS is_platform_course boolean NOT NULL DEFAULT false;

UPDATE public.courses
SET is_platform_course = COALESCE(NOT is_custom, false)
WHERE is_platform_course IS DISTINCT FROM COALESCE(NOT is_custom, false);
