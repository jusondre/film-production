-- Film Production, step 4: file storage for projects.
-- Run AFTER step2_projects.sql: SQL Editor, New query, paste, Run. Safe to run more than once.
-- Files live in a private bucket, one folder per project (named by the project id).
-- Anyone who can open a project can see and download its files; editors and admins can upload and delete.

-- 1. The bucket (private, 50 MB per file) -------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- 2. Which project a file belongs to: the first folder in its path ----------------
create or replace function public.file_project(path text) returns uuid
language plpgsql immutable as $$
begin return split_part(path, '/', 1)::uuid; exception when others then return null; end $$;

-- 3. Rules --------------------------------------------------------------------
drop policy if exists "read project files"   on storage.objects;
drop policy if exists "upload project files" on storage.objects;
drop policy if exists "delete project files" on storage.objects;

create policy "read project files" on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and public.can_read_project(public.file_project(name)));
create policy "upload project files" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.can_edit_project(public.file_project(name)));
create policy "delete project files" on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and public.can_edit_project(public.file_project(name)));
