-- Bootstrap for fresh Supabase projects.
-- Production historically had public.profiles created outside the tracked
-- migration chain, but a clean staging database needs this baseline table.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'student',
  full_name text NULL,
  avatar_url text NULL
);

COMMENT ON TABLE public.profiles IS 'Application profile mirror for auth.users.';
COMMENT ON COLUMN public.profiles.role IS 'Application role: student, teacher, curator.';
