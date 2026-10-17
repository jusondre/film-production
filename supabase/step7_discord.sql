-- Film Production, step 7: sign-in with Discord.
-- Run AFTER step4: SQL Editor, New query, paste, Run. Safe to run more than once.
--
-- Nobody gets in without a Discord account that is in your server. Members can look at everything;
-- members with the admin role can also change things. Discord decides, not this database:
-- the discord-access function asks Discord and writes the answer to the table below.

-- 1. Who Discord says is in the server, and when it was last checked --------------------------
create table if not exists public.discord_access (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null,
  name       text,
  avatar_url text,
  is_member  boolean not null default false,
  is_admin   boolean not null default false,
  checked_at timestamptz not null default now()
);
alter table public.discord_access enable row level security;
-- No policies on purpose: only the function (service key) and the helpers below can touch it.

-- 2. The helpers every access rule uses. An answer older than 6 hours stops counting,
--    so someone who left the server can't keep going on an old check. ----------------------------
create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.discord_access
    where user_id = auth.uid() and is_member and checked_at > now() - interval '6 hours');
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.discord_access
    where user_id = auth.uid() and is_member and is_admin and checked_at > now() - interval '6 hours');
$$;
create or replace function public.can_read_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.is_approved(); $$;
create or replace function public.can_edit_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$ select public.is_admin(); $$;

-- 3. Rules: members read, admins change ------------------------------------------------------
drop policy if exists "anyone reads projects" on public.projects;
drop policy if exists "read projects" on public.projects;
create policy "read projects" on public.projects for select using (public.can_read_project(id));

drop policy if exists "anyone reads project files" on storage.objects;   -- earlier open-viewing rule
-- (step4 already made the file rules follow can_read_project / can_edit_project, which now mean Discord member / admin.)

-- 4. The old email-and-password machinery is no longer used ------------------------------------
drop trigger  if exists on_auth_user_created on auth.users;          -- it only allowed invited emails
drop trigger  if exists on_auth_user_signed_in on auth.users;
drop function if exists public.remove_editor(text);
drop function if exists public.shared_project(text);               -- earlier share-link idea
alter table public.projects drop column if exists share_token;
