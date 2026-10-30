-- Atomic catalog initialization / additive backup restore. Existing records are never overwritten.
create function public.import_bundle(payload jsonb) returns int language plpgsql security invoker set search_path=public as $$
declare t text; item jsonb; existing_owner uuid; n int; begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if payload->>'schema_version'<>'1' then raise exception 'Unsupported schema'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 foreach t in array array['models','gyms','instances','templates'] loop
 if jsonb_array_length(coalesce(payload->t,'[]'))>10000 then raise exception 'Too many records'; end if;
 for item in select value from jsonb_array_elements(coalesce(payload->t,'[]')) loop
 if t='models' then item:=(item-'primary')||jsonb_build_object('primary_muscles',item->'primary'); end if;
 item:=item||jsonb_build_object('user_id',auth.uid(),'created_at',now());
 execute format('insert into public.%I select (jsonb_populate_record(null::public.%I,$1)).* on conflict(id) do nothing',t,t) using item;
 end loop;
 end loop;
 n:=public.import_sessions(coalesce(payload->'sessions','[]'));
 return n;
end $$;
revoke all on function public.import_bundle(jsonb) from public,anon;
grant execute on function public.import_bundle(jsonb) to authenticated;
