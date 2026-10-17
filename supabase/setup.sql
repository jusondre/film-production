-- Film Production: accounts and access control.
-- Run this once in Supabase: SQL Editor, New query, paste, Run.

-- 1. Tables ------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  role       text not null default 'member'  check (role in ('member', 'admin')),
  status     text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  created_at timestamptz not null default now()
);

-- Emails the admin approved ahead of time. Whoever signs up with one is let straight in.
create table public.invites (
  email      text primary key,
  role       text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.invites  enable row level security;

-- 2. Helpers (security definer so policies can check roles without looping) ----
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'approved');
$$;

-- Used by later steps (crew, calendar, tasks...) to lock data to approved people.
create function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'approved');
$$;

-- 3. Who can do what ------------------------------------------------------
create policy "read own profile"    on public.profiles for select using (id = auth.uid());
create policy "admin reads all"     on public.profiles for select using (public.is_admin());
create policy "admin updates all"   on public.profiles for update using (public.is_admin()) with check (public.is_admin());
create policy "admin manages invites" on public.invites for all using (public.is_admin()) with check (public.is_admin());
-- There is deliberately no insert policy and no self-update policy:
-- nobody can approve themselves or make themselves an admin through the website.

-- 4. Every new sign-up gets a profile: approved if invited, otherwise pending ------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare invite public.invites%rowtype;
begin
  select * into invite from public.invites where email = lower(new.email);
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id, lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(invite.role, 'member'),
    case when invite.email is not null then 'approved' else 'pending' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. YOU, the first admin -------------------------------------------------
-- Replace the email below with the one you will sign in with, then run the script.
-- Only the owner of this Supabase project can run SQL, so nobody else can add themselves here.
insert into public.invites (email, role) values (lower('you@example.com'), 'admin')
on conflict (email) do nothing;

-- If you already signed in BEFORE running this, run this line instead (with your email):
-- update public.profiles set role = 'admin', status = 'approved' where email = 'you@example.com';
