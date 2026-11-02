alter table public.account_handles add column display_username text;
update public.account_handles set display_username = username;
alter table public.account_handles alter column display_username set not null;

create function public.format_account_handle() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.display_username := new.username;
  new.username := lower(new.username collate "C");
  if tg_op = 'UPDATE' and new.username ~ '^lifter_[0-9]+$' and new.username <> old.username then
    raise insufficient_privilege using message = 'This username is reserved.';
  end if;
  return new;
end;
$$;
create trigger format_account_handle before insert or update of username on public.account_handles
  for each row execute function public.format_account_handle();
alter policy edit_own_handle on public.account_handles
  with check (user_id = (select auth.uid()));
