-- Расширяем настройки фото-обложки курса:
-- масштаб, отражение по горизонтали/вертикали и поддержка новых форматов файлов.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS cover_image_scale double precision NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cover_image_flip_x boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_image_flip_y boolean NOT NULL DEFAULT false;

ALTER TABLE public.courses
  ALTER COLUMN cover_image_scale SET DEFAULT 1,
  ALTER COLUMN cover_image_flip_x SET DEFAULT false,
  ALTER COLUMN cover_image_flip_y SET DEFAULT false;

UPDATE public.courses
SET
  cover_image_scale = COALESCE(cover_image_scale, 1),
  cover_image_flip_x = COALESCE(cover_image_flip_x, false),
  cover_image_flip_y = COALESCE(cover_image_flip_y, false);

COMMENT ON COLUMN public.courses.cover_image_scale IS 'Масштаб фото-обложки курса, 1 = базовый cover-fit';
COMMENT ON COLUMN public.courses.cover_image_flip_x IS 'Отражать фото-обложку курса по горизонтали';
COMMENT ON COLUMN public.courses.cover_image_flip_y IS 'Отражать фото-обложку курса по вертикали';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-covers',
  'course-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
