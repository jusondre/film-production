-- Film Production, step 5: sign-up details (name, phone), accepted vs pending, and crew autofill.
-- Run AFTER step4_files.sql: SQL Editor, New query, paste, Run. Safe to run more than once.

-- 1. What each person fills in when they accept an invitation ------------------------
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name  text;
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists joined_at  timestamptz;  -- set when the sign-up form is completed

-- Everyone who already signed in before this step counts as accepted.
update public.profiles set joined_at = signed_in_at where joined_at is null and signed_in_at is not null;

-- 2. Saving your own details. People can't edit profiles directly (so nobody can approve themselves),
--    so this function updates only the caller's name and phone. -------------------------------------
create or replace function public.save_my_profile(p_first text, p_last text, p_phone text) returns void
language sql security definer set search_path = public as $$
  update public.profiles set
    first_name = trim(p_first), last_name = trim(p_last), phone = trim(p_phone),
    full_name  = trim(trim(p_first) || ' ' || trim(p_last)),
    joined_at  = coalesce(joined_at, now())
  where id = auth.uid();
$$;
revoke all on function public.save_my_profile(text, text, text) from public;
grant execute on function public.save_my_profile(text, text, text) to authenticated;

-- 3. Who is on a project, with contact details, for the Crew tab's autofill.
--    Anyone who can open the project can ask; nobody else gets anything back. --------------------------
create or replace function public.project_people(pid uuid)
returns table (email text, role text, full_name text, phone text, joined boolean)
language sql stable security definer set search_path = public as $$
  select m.email, m.role, p.full_name, p.phone, (p.joined_at is not null)
  from public.project_members m
  left join public.profiles p on p.email = m.email
  where m.project_id = pid and public.can_read_project(pid);
$$;
revoke all on function public.project_people(uuid) from public;
grant execute on function public.project_people(uuid) to authenticated;
