-- Гарантированно добавить колонки фото-обложки (если предыдущая миграция не доехала до БД).
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS cover_image_url text NULL,
  ADD COLUMN IF NOT EXISTS cover_image_position text NULL DEFAULT '50% 50%';
