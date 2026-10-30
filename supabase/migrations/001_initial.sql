-- Run once in a new Supabase project. All personal data is owner-scoped.
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', timezone text not null default 'America/Denver', created_at timestamptz not null default now());
create table public.models (id uuid primary key, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade, name text not null check(length(name) between 1 and 200), manufacturer text not null default '', model text not null default '', category text not null default 'Custom', nickname text not null default '', primary_muscles text[] not null default '{}', secondary text[] not null default '{}', exercises text[] not null default '{}', notes text not null default '', rating int check(rating between 1 and 5), comfort int check(comfort between 1 and 5), adjustability int check(adjustability between 1 and 5), movement int check(movement between 1 and 5), favorite boolean not null default false, photo text, created_at timestamptz not null default now(), unique(user_id,id));
create table public.gyms (id uuid primary key,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 200),location text not null default '',notes text not null default '',rating int check(rating between 1 and 5),favorite boolean not null default false,photo text,created_at timestamptz not null default now(),unique(user_id,id));
create table public.instances (id uuid primary key,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,gym_id uuid not null,model_id uuid not null,notes text not null default '',rating int check(rating between 1 and 5),unique(user_id,id),foreign key(user_id,gym_id) references public.gyms(user_id,id),foreign key(user_id,model_id) references public.models(user_id,id));
create table public.templates (id uuid primary key,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 200),position int not null default 0 check(position>=0),scheduled_date date,exercises jsonb not null default '[]' check(jsonb_typeof(exercises)='array'),unique(user_id,id));
create table public.sessions (id uuid primary key,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 200),date date not null,started_at timestamptz,ended_at timestamptz,gym_id uuid,gym_name text not null default 'Not recorded',status text not null check(status in ('active','completed')),notes text not null default '',source text not null default '',import_key text,revision int not null default 1,template_id uuid,unique(user_id,id),unique(user_id,import_key),foreign key(user_id,gym_id) references public.gyms(user_id,id),check(ended_at is null or started_at is null or ended_at>=started_at));
create unique index one_active_session on public.sessions(user_id) where status='active';
create table public.session_exercises (id uuid primary key,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,session_id uuid not null,model_id uuid not null,instance_id uuid,name text not null,equipment_name text not null,primary_muscles text[] not null default '{}',secondary text[] not null default '{}',config jsonb not null,skipped boolean not null default false,notes text not null default '',position int not null,unique(user_id,id),foreign key(user_id,session_id) references public.sessions(user_id,id) on delete cascade,foreign key(user_id,model_id) references public.models(user_id,id),foreign key(user_id,instance_id) references public.instances(user_id,id),check(config->>'pulley' in ('none','single','dual')),check(config->>'load_basis' in ('stack','per_stack','combined','total','added_plates','assistance','unknown')));
create table public.sets (id uuid primary key,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,exercise_id uuid not null,position int not null,weight numeric check(weight between 0 and 10000),reps int not null check(reps between 1 and 1000),rir numeric check(rir between 0 and 10),warmup boolean not null default false,completed boolean not null default true,verified boolean not null default true,approximate boolean not null default false,notes text not null default '',foreign key(user_id,exercise_id) references public.session_exercises(user_id,id) on delete cascade);
create table public.measurements (id uuid primary key,user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,date date not null,body_weight_lb numeric check(body_weight_lb>0),notes text not null default '');
create index session_date on public.sessions(user_id,date);
create index exercise_session on public.session_exercises(user_id,session_id,position);
create index set_exercise on public.sets(user_id,exercise_id,position);
create index instance_gym on public.instances(user_id,gym_id);
do $$ declare t text; begin
foreach t in array array['models','gyms','instances','templates','sessions','session_exercises','sets','measurements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('revoke all on public.%I from anon',t);
end loop;
end $$;
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
grant select,insert,update,delete on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- Atomic session writes. Revision checks prevent silently overwriting another tab/device.
create function public.save_session(payload jsonb) returns int language plpgsql security invoker set search_path=public as $$
declare u uuid:=auth.uid(); sid uuid:=(payload->>'id')::uuid; oldrev int; nextrev int; e jsonb; s jsonb; ep int:=0; sp int; eid uuid;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if jsonb_array_length(payload->'exercises')>100 then raise exception 'Too many exercises'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select revision into oldrev from public.sessions where id=sid and user_id=u for update;
 if oldrev is not null and oldrev<>coalesce((payload->>'revision')::int,0) then raise exception 'Conflict: another device saved this workout. Reload before editing.'; end if;
 if oldrev is null and coalesce((payload->>'revision')::int,0)<>0 then raise exception 'Workout no longer exists'; end if;
 nextrev:=coalesce(oldrev,0)+1;
 insert into public.sessions(id,user_id,name,date,started_at,ended_at,gym_id,gym_name,status,notes,source,import_key,revision,template_id)
 values(sid,u,payload->>'name',(payload->>'date')::date,(payload->>'started_at')::timestamptz,(payload->>'ended_at')::timestamptz,(payload->>'gym_id')::uuid,coalesce(payload->>'gym_name','Not recorded'),payload->>'status',coalesce(payload->>'notes',''),coalesce(payload->>'source',''),payload->>'import_key',nextrev,(payload->>'template_id')::uuid)
 on conflict(id) do update set name=excluded.name,date=excluded.date,started_at=excluded.started_at,ended_at=excluded.ended_at,gym_id=excluded.gym_id,gym_name=excluded.gym_name,status=excluded.status,notes=excluded.notes,source=excluded.source,import_key=excluded.import_key,revision=excluded.revision,template_id=excluded.template_id;
 delete from public.session_exercises where user_id=u and session_id=sid;
 for e in select value from jsonb_array_elements(payload->'exercises') loop
 eid:=(e->>'id')::uuid;
 if (e->>'instance_id') is not null and not exists(select 1 from public.instances where id=(e->>'instance_id')::uuid and user_id=u and model_id=(e->>'model_id')::uuid and (payload->>'gym_id')::uuid=gym_id) then raise exception 'Equipment instance does not match model and gym'; end if;
 insert into public.session_exercises(id,user_id,session_id,model_id,instance_id,name,equipment_name,primary_muscles,secondary,config,skipped,notes,position)
 values(eid,u,sid,(e->>'model_id')::uuid,(e->>'instance_id')::uuid,e->>'name',e->>'equipment_name',array(select jsonb_array_elements_text(e->'primary')),array(select jsonb_array_elements_text(e->'secondary')),e->'config',coalesce((e->>'skipped')::boolean,false),coalesce(e->>'notes',''),ep);
 ep:=ep+1; sp:=0;
 if jsonb_array_length(e->'sets')>200 then raise exception 'Too many sets'; end if;
 for s in select value from jsonb_array_elements(e->'sets') loop
 insert into public.sets(id,user_id,exercise_id,position,weight,reps,rir,warmup,completed,verified,approximate,notes)
 values((s->>'id')::uuid,u,eid,sp,(s->>'weight')::numeric,(s->>'reps')::int,(s->>'rir')::numeric,coalesce((s->>'warmup')::boolean,false),coalesce((s->>'completed')::boolean,true),coalesce((s->>'verified')::boolean,true),coalesce((s->>'approximate')::boolean,false),coalesce(s->>'notes',''));
 sp:=sp+1;
 end loop;
 end loop;
 return nextrev;
end $$;
revoke all on function public.save_session(jsonb) from public,anon;
grant execute on function public.save_session(jsonb) to authenticated;

-- Import is all-or-nothing; stable session IDs/import keys make retries idempotent.
create function public.import_sessions(payload jsonb) returns int language plpgsql security invoker set search_path=public as $$
declare s jsonb; count_saved int:=0; begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if jsonb_array_length(payload)>500 then raise exception 'Import limited to 500 sessions'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 for s in select value from jsonb_array_elements(payload) loop
 if not exists(select 1 from public.sessions where user_id=auth.uid() and (id=(s->>'id')::uuid or (s->>'import_key' is not null and import_key=s->>'import_key'))) then
 perform public.save_session(s||jsonb_build_object('revision',0)); count_saved:=count_saved+1;
 end if;
 end loop;
 return count_saved;
end $$;
revoke all on function public.import_sessions(jsonb) from public,anon;
grant execute on function public.import_sessions(jsonb) to authenticated;
