-- Film Production, step 2: projects, who can see them, and invite-only sign-up.
-- Run AFTER setup.sql: SQL Editor, New query, paste, Run. Safe to run more than once.

-- 1. Tables ------------------------------------------------------------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  data       jsonb not null default '{}'::jsonb,   -- crew, calendar, tasks, boards...
  version    integer not null default 1,           -- used to detect two people saving at once
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who belongs to which project, by email. Site admins see everything without being listed.
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  email      text not null check (email = lower(email)),
  role       text not null check (role in ('editor', 'viewer')),
  added_at   timestamptz not null default now(),
  primary key (project_id, email)
);

alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
grant select, insert, update, delete on public.projects, public.project_members to authenticated;

-- 2. Helpers -------------------------------------------------------------
create or replace function public.my_email() returns text
language sql stable as $$ select lower(auth.jwt() ->> 'email') $$;

create or replace function public.can_read_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_approved() and exists (
    select 1 from public.project_members m where m.project_id = pid and m.email = public.my_email()));
$$;

create or replace function public.can_edit_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.is_approved() and exists (
    select 1 from public.project_members m
    where m.project_id = pid and m.email = public.my_email() and m.role = 'editor'));
$$;

-- 3. Rules -----------------------------------------------------------------
drop policy if exists "read projects"   on public.projects;
drop policy if exists "create projects" on public.projects;
drop policy if exists "edit projects"   on public.projects;
drop policy if exists "delete projects" on public.projects;
create policy "read projects"   on public.projects for select using (public.can_read_project(id));
create policy "create projects" on public.projects for insert with check (public.is_admin());
create policy "edit projects"   on public.projects for update using (public.can_edit_project(id)) with check (public.can_edit_project(id));
create policy "delete projects" on public.projects for delete using (public.is_admin());

drop policy if exists "see own membership"  on public.project_members;
drop policy if exists "admin manages members" on public.project_members;
create policy "see own membership"    on public.project_members for select using (public.is_admin() or email = public.my_email());
create policy "admin manages members" on public.project_members for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_project() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_project();

-- 4. Invite-only sign-up -------------------------------------------------------
-- Only emails the admin added (to a project, or as an admin invite) can create an account.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare invite public.invites%rowtype;
begin
  select * into invite from public.invites where email = lower(new.email);
  if invite.email is null
     and not exists (select 1 from public.project_members where email = lower(new.email)) then
    raise exception 'not_invited';
  end if;
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id, lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(invite.role, 'member'), 'approved'
  );
  return new;
end $$;
