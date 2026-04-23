-- Extend lesson block type constraint for the course-builder replica screen.
ALTER TABLE public.lesson_blocks DROP CONSTRAINT IF EXISTS lesson_blocks_type_check;

ALTER TABLE public.lesson_blocks
ADD CONSTRAINT lesson_blocks_type_check CHECK (
  type IN (
    'text',
    'matching',
    'fill_gaps',
    'quiz_single',
    'quiz_multi',
    'sentence_builder',
    'flashcards',
    'homework',
    'audio',
    'image',
    'video',
    'pdf',
    'speaking',
    'note',
    'link',
    'divider'
  )
);
