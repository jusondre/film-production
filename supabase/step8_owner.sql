-- Film Production, step 8: only the Discord user "jusondre" may delete a project.
-- Run AFTER step7: SQL Editor, New query, paste, Run. Safe to run more than once.
--
-- Being an admin is not enough. The discord-access function records the Discord username it gets
-- from Discord itself (not from anything the user can edit), and the delete rule checks it.
-- Deploy the updated discord-access function too, otherwise the username is never recorded
-- and nobody can delete.

alter table public.discord_access add column if not exists username text;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.discord_access
    where user_id = auth.uid() and is_member and is_admin
      and lower(username) = 'jusondre'
      and checked_at > now() - interval '6 hours');
$$;

drop policy if exists "delete projects" on public.projects;
create policy "delete projects" on public.projects for delete using (public.is_owner());
