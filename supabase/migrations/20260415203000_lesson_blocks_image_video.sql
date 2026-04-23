-- Allow image and video lesson block types (editor + student view).

ALTER TABLE public.lesson_blocks DROP CONSTRAINT IF EXISTS lesson_blocks_type_check;

ALTER TABLE public.lesson_blocks
ADD CONSTRAINT lesson_blocks_type_check CHECK (
  type IN (
    'text',
    'matching',
    'fill_gaps',
    'quiz_single',
    'audio',
    'image',
    'video'
  )
);
