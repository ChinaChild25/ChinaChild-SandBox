alter table public.lessons
  add column if not exists room_url text;

comment on column public.lessons.room_url is
  'Daily.co room URL for the lesson video call. Created lazily on first join.';
