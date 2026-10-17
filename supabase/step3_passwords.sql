-- Film Production, step 3: password sign-in. Run in the SQL Editor. Safe to run more than once.

-- Remember who has actually signed in, so the Admin tab can tell "invited" from "joined".
alter table public.profiles add column if not exists signed_in_at timestamptz;

create or replace function public.mark_signed_in() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is not null and new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.profiles set signed_in_at = new.last_sign_in_at where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.mark_signed_in();

update public.profiles p set signed_in_at = u.last_sign_in_at
from auth.users u where u.id = p.id and u.last_sign_in_at is not null and p.signed_in_at is null;

-- Make sure you are the admin.
insert into public.invites (email, role) values ('justusondre@gmail.com', 'admin')
on conflict (email) do update set role = 'admin';
update public.profiles set role = 'admin', status = 'approved' where email = 'justusondre@gmail.com';
