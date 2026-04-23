-- Закрепление ученика за преподавателем (один основной преподаватель на ученика).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_teacher_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_assigned_teacher_id_idx
  ON public.profiles (assigned_teacher_id)
  WHERE assigned_teacher_id IS NOT NULL;

-- Закрепление по запросу: ученик 92bba875-… → преподаватель 50318f92-…
UPDATE public.profiles
SET assigned_teacher_id = '50318f92-b863-4fb4-a9a8-fe23e6507c45'::uuid
WHERE id = '92bba875-b74e-4836-be1c-9d5aecb574f9'::uuid;
