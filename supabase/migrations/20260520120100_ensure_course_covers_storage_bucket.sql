-- Bucket и политики для обложек (идемпотентно, если 20260519183000 не применилась целиком).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-covers',
  'course-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "course_covers_public_read" ON storage.objects;
CREATE POLICY "course_covers_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'course-covers');

DROP POLICY IF EXISTS "course_covers_insert_own_folder" ON storage.objects;
CREATE POLICY "course_covers_insert_own_folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "course_covers_update_own_folder" ON storage.objects;
CREATE POLICY "course_covers_update_own_folder"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'course-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "course_covers_delete_own_folder" ON storage.objects;
CREATE POLICY "course_covers_delete_own_folder"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'course-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
