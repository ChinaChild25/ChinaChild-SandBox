-- Extend lesson block type constraint for new constructor blocks.
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
    'video',
    'note',
    'link',
    'divider'
  )
);
