-- Money Tracker cloud schema (Supabase / Postgres).
-- Safe to run more than once.
--
-- One row per card / person / transaction. `data` is the same JSON the app
-- stores locally. Deletions are kept as rows with deleted = true so they
-- reach every device. Row-level security: each user sees only their rows.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null,
  id         text        not null check (char_length(id) between 1 and 100),
  data       jsonb,
  deleted    boolean     not null default false,
  -- time of the change on the device that made it ("last change wins")
  updated_at timestamptz not null,
  -- server time the row last changed; devices pull rows newer than this
  synced_at  timestamptz not null default now(),
  primary key (user_id, kind, id),
  constraint data_present check (deleted or data is not null)
);

-- Allowed record kinds (v2.5 added 'history' for payment-status history).
alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check
  check (kind in ('transaction', 'card', 'person', 'history'));

create index if not exists records_user_synced_idx on public.records (user_id, synced_at);

alter table public.records enable row level security;

drop policy if exists "own rows: select" on public.records;
drop policy if exists "own rows: insert" on public.records;
drop policy if exists "own rows: update" on public.records;
drop policy if exists "own rows: delete" on public.records;
create policy "own rows: select" on public.records for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows: insert" on public.records for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own rows: update" on public.records for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows: delete" on public.records for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

-- Upload a batch of changes. Each row is written only if it is newer than
-- the copy already stored; rows where the stored copy is newer are returned
-- so the device can take them. Runs with the caller's rights (RLS applies).
create or replace function public.push_records(items jsonb)
returns setof public.records
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 1000 then
    raise exception 'items must be an array of at most 1000 changes';
  end if;

  insert into public.records as r (user_id, kind, id, data, deleted, updated_at)
  select auth.uid(),
         x->>'kind',
         x->>'id',
         case when coalesce((x->>'deleted')::boolean, false) then null else x->'data' end,
         coalesce((x->>'deleted')::boolean, false),
         (x->>'updated_at')::timestamptz
  from jsonb_array_elements(items) as x
  on conflict (user_id, kind, id) do update
    set data = excluded.data,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at,
        synced_at = now()
    where excluded.updated_at > r.updated_at;

  return query
    select r.*
    from public.records r
    join jsonb_array_elements(items) as x
      on r.user_id = auth.uid() and r.kind = x->>'kind' and r.id = x->>'id'
    where r.updated_at > (x->>'updated_at')::timestamptz;
end;
$$;

revoke all on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
