-- Расширение public.profiles + RLS + Storage bucket avatars
-- Идемпотентно: не пересоздаём таблицу, только добавляем недостающее.
--
-- Если триггер не создаётся: замените EXECUTE FUNCTION на EXECUTE PROCEDURE
-- (зависит от версии Postgres в проекте).

-- ── Колонки profiles ─────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- role / full_name / avatar_url могли уже существовать
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'student';

UPDATE public.profiles SET role = 'student' WHERE role IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN role SET NOT NULL;

-- Backfill: full_name из имени + фамилии, если пусто
UPDATE public.profiles
SET
  full_name = trim(
    concat_ws(
      ' ',
      NULLIF(trim(first_name), ''),
      NULLIF(trim(last_name), '')
    )
  )
WHERE
  (full_name IS NULL OR btrim(full_name) = '')
  AND (
    NULLIF(trim(first_name), '') IS NOT NULL
    OR NULLIF(trim(last_name), '') IS NOT NULL
  );

-- Backfill: разнести существующий full_name в first/last (только если оба пусты)
UPDATE public.profiles
SET
  first_name = split_part(btrim(full_name), ' ', 1),
  last_name = nullif(
    trim(substring(btrim(full_name) from length(split_part(btrim(full_name), ' ', 1)) + 2)),
    ''
  )
WHERE
  (first_name IS NULL OR btrim(first_name) = '')
  AND (last_name IS NULL OR btrim(last_name) = '')
  AND full_name IS NOT NULL
  AND btrim(full_name) <> '';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profiles_updated_at ON public.profiles;
CREATE TRIGGER on_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profiles_updated_at();

-- ── RLS profiles ───────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ── Storage: bucket avatars (публичные URL для отображения в UI) ───────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Объекты: путь <user_id>/... внутри bucket avatars
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_authenticated_insert_own_folder" ON storage.objects;
CREATE POLICY "avatars_authenticated_insert_own_folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_authenticated_update_own_folder" ON storage.objects;
CREATE POLICY "avatars_authenticated_update_own_folder"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_authenticated_delete_own_folder" ON storage.objects;
CREATE POLICY "avatars_authenticated_delete_own_folder"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
