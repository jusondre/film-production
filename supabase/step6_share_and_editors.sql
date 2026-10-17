-- Film Production, step 6: view links for viewers, sign-in codes for editors.
-- Run AFTER step4_files.sql: SQL Editor, New query, paste, Run. Safe to run more than once.
--
-- Viewers have no account: anyone with a project's view link can see it, read-only.
-- Editors are emails you add in the Admin screen; they sign in with a code sent to that email.

-- 1. A secret view-link token for every project --------------------------------
alter table public.projects add column if not exists share_token text;
update public.projects
  set share_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  where share_token is null;
alter table public.projects
  alter column share_token set default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  alter column share_token set not null;
create unique index if not exists projects_share_token_key on public.projects (share_token);

-- 2. What a view link may read: that one project, nothing else ----------------------
-- Runs with the owner's rights so people who are not signed in can open a project, but only
-- when they know its token. The token itself is never returned.
create or replace function public.shared_project(t text)
returns table (id uuid, title text, data jsonb, version integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.data, p.version
  from public.projects p
  where length(coalesce(t, '')) >= 32 and p.share_token = t;
$$;
revoke all on function public.shared_project(text) from public;
grant execute on function public.shared_project(text) to anon, authenticated;

-- 3. Removing an editor deletes their account completely ---------------------------
create or replace function public.remove_editor(p_email text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Only admins can remove editors.'; end if;
  if exists (select 1 from public.profiles where email = v_email and (id = auth.uid() or role = 'admin')) then
    raise exception 'Admin accounts can’t be removed here.';
  end if;
  delete from public.project_members where email = v_email;
  delete from public.invites         where email = v_email;
  delete from auth.users             where lower(email) = v_email;   -- the profile goes with it
  delete from public.profiles        where email = v_email;
end $$;
revoke all on function public.remove_editor(text) from public;
grant execute on function public.remove_editor(text) to authenticated;

-- 4. Everyone who was a "viewer" before now uses the view link instead -----------------
delete from public.project_members where role = 'viewer';
