create sequence public.account_handle_number;
create table public.account_handles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique default ('lifter_' || nextval('public.account_handle_number')),
  constraint username_format check (username ~ '^[a-z0-9_]{3,24}$')
);
alter table public.account_handles enable row level security;
revoke all on public.account_handles from public, anon, authenticated;
grant select, update (username) on public.account_handles to authenticated;
create policy read_own_handle on public.account_handles for select to authenticated
  using (user_id = (select auth.uid()));
create policy edit_own_handle on public.account_handles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and username !~ '^lifter_[0-9]+$');

create function public.initialize_account_handle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_handles(user_id) values (new.id);
  return new;
end;
$$;
revoke all on function public.initialize_account_handle() from public, anon, authenticated;
create trigger initialize_account_handle after insert on auth.users
  for each row execute function public.initialize_account_handle();
insert into public.account_handles(user_id) select id from auth.users
  on conflict (user_id) do nothing;
