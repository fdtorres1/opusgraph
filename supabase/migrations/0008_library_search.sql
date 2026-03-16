-- =========
-- 1. Library Entry Search Table
-- =========
create table if not exists library_entry_search (
  library_entry_id uuid primary key references library_entry(id) on delete cascade,
  organization_id uuid not null references organization(id),
  search_vector tsvector not null
);

-- =========
-- 2. Indexes
-- =========
create index if not exists idx_library_search_vector on library_entry_search using gin(search_vector);
create index if not exists idx_library_search_org on library_entry_search(organization_id);

-- =========
-- 3. Helper: rebuild_library_entry_search(uuid)
-- =========
create or replace function rebuild_library_entry_search(p_entry_id uuid) returns void
language plpgsql as $$
declare
  p_org_id uuid;
  p_overrides jsonb;
  p_notes text;
  part_names text;
  vec tsvector;
begin
  -- Look up the library entry
  select le.organization_id, le.overrides, le.notes
    into p_org_id, p_overrides, p_notes
    from library_entry le
    where le.id = p_entry_id;

  -- If entry doesn't exist, nothing to do
  if not found then
    return;
  end if;

  -- Collect part names for this entry
  select coalesce(string_agg(lep.part_name, ' '), '')
    into part_names
    from library_entry_part lep
    where lep.library_entry_id = p_entry_id;

  -- Build the weighted search vector
  vec :=
    setweight(to_tsvector('simple', coalesce(p_overrides->>'title', '')), 'A') ||
    setweight(to_tsvector('simple',
      coalesce(p_overrides->>'composer_first_name', '') || ' ' ||
      coalesce(p_overrides->>'composer_last_name', '') || ' ' ||
      coalesce(p_overrides->>'arranger', '')
    ), 'B') ||
    setweight(to_tsvector('simple',
      coalesce(p_overrides->>'publisher', '') || ' ' ||
      coalesce(p_overrides->>'instrumentation', '') || ' ' ||
      coalesce(part_names, '')
    ), 'C') ||
    setweight(to_tsvector('simple', coalesce(p_notes, '')), 'D');

  -- Upsert into search table
  insert into library_entry_search(library_entry_id, organization_id, search_vector)
  values (p_entry_id, p_org_id, vec)
  on conflict (library_entry_id) do update set
    organization_id = excluded.organization_id,
    search_vector = excluded.search_vector;
end; $$;

-- =========
-- 4. Trigger Function: update_library_entry_search()
-- =========
create or replace function update_library_entry_search() returns trigger language plpgsql as $$
begin
  perform rebuild_library_entry_search(new.id);
  return new;
end; $$;

-- =========
-- 5. Trigger on library_entry
-- =========
drop trigger if exists trg_library_entry_search_upsert on library_entry;
create trigger trg_library_entry_search_upsert
after insert or update of overrides, notes, organization_id on library_entry
for each row execute procedure update_library_entry_search();

-- =========
-- 6. Trigger Function: update_library_entry_search_on_part()
-- =========
create or replace function update_library_entry_search_on_part() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform rebuild_library_entry_search(old.library_entry_id);
  else
    perform rebuild_library_entry_search(new.library_entry_id);
  end if;
  return coalesce(new, old);
end; $$;

-- =========
-- 7. Trigger on library_entry_part
-- =========
drop trigger if exists trg_library_entry_part_search on library_entry_part;
create trigger trg_library_entry_part_search
after insert or update of part_name or delete on library_entry_part
for each row execute procedure update_library_entry_search_on_part();

-- =========
-- 8. RLS Policies
-- =========
alter table library_entry_search enable row level security;

drop policy if exists select_library_entry_search_member on library_entry_search;
create policy select_library_entry_search_member on library_entry_search
for select using (is_org_member(organization_id));

-- =========
-- Done
-- =========
