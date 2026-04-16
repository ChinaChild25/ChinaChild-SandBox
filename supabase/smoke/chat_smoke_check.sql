-- Chat Smoke Check (10-12 queries)
-- Run in Supabase SQL editor as authenticated user context when possible.

-- 1) Core chat tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'conversations',
    'conversation_participants',
    'messages',
    'message_reads',
    'user_presence',
    'typing_indicators'
  )
order by table_name;

-- 2) Required modern message columns exist
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'messages'
  and column_name in ('media_url', 'media_type', 'media_size', 'reply_to_id', 'edited_at', 'deleted_at')
order by column_name;

-- 3) chat peer view exists
select table_name
from information_schema.views
where table_schema = 'public'
  and table_name = 'chat_peer_profiles';

-- 4) Critical RPCs exist
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_chat_capabilities',
    'get_or_create_direct_conversation',
    'ensure_profile_for_current_user',
    'upsert_presence',
    'set_typing',
    'edit_message',
    'soft_delete_message',
    'mark_conversation_read'
  )
order by p.proname;

-- 5) Non-recursive teacher helper exists
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_current_user_teacher';

-- 6) profiles policies snapshot
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
order by policyname;

-- 7) conversation_participants policies snapshot
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'conversation_participants'
order by policyname;

-- 8) messages policies snapshot
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'messages'
order by policyname;

-- 9) Storage policies for chat-media bucket
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in ('chat_media_upload', 'chat_media_select', 'chat_media_delete_own')
order by policyname;

-- 10) Realtime publication contains chat support tables
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('messages', 'user_presence', 'typing_indicators')
order by tablename;

-- 11) Capability contract result (single source for client gating)
select *
from public.get_chat_capabilities();

-- 12) Current user profile + role visibility sanity
select id, role, first_name, last_name, full_name
from public.profiles
where id = auth.uid();
