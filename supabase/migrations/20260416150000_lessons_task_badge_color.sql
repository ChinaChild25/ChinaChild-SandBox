alter table public.lessons
add column if not exists task_badge_color text;

-- keep it optional; UI uses a controlled palette and can default client-side
