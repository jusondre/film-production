-- Film Production, step 6: open viewing for everyone, sign-in codes for editors.
-- Run AFTER step4_files.sql: SQL Editor, New query, paste, Run. Safe to run more than once.
--
-- Anyone who opens the site can LOOK at the projects and files without signing in.
-- Only editors (emails you add in the Admin screen) can change things, after signing in with an emailed code.

-- 1. Everyone can read projects (changing them still needs an editor or admin) ---------------
drop policy if exists "read projects" on public.projects;
drop policy if exists "anyone reads projects" on public.projects;
create policy "anyone reads projects" on public.projects for select to anon, authenticated using (true);

-- 2. Everyone can see and download files ------------------------------------------------------
drop policy if exists "anyone reads project files" on storage.objects;
create policy "anyone reads project files" on storage.objects for select to anon, authenticated
  using (bucket_id = 'project-files');

-- 3. Clean up the earlier share-link idea, if it was installed ----------------------------------
drop function if exists public.shared_project(text);
alter table public.projects drop column if exists share_token;

-- 4. Removing an editor deletes their account completely ---------------------------------------
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

-- 5. Everyone who was a "viewer" before simply views the site now ------------------------------
delete from public.project_members where role = 'viewer';
