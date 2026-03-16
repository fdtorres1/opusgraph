-- =========
-- 1. Library Entry Table
-- =========
create table if not exists library_entry (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  reference_work_id uuid references work(id) on delete set null,
  overrides jsonb not null default '{}'::jsonb,
  copies_owned integer not null default 0 check (copies_owned >= 0),
  location text,
  condition text check (condition in ('excellent', 'good', 'fair', 'poor', 'missing')),
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========
-- 2. Library Entry Part Table
-- =========
create table if not exists library_entry_part (
  id uuid primary key default gen_random_uuid(),
  library_entry_id uuid not null references library_entry(id) on delete cascade,
  part_name text not null,
  quantity integer not null default 1 check (quantity >= 0),
  condition text check (condition in ('excellent', 'good', 'fair', 'poor', 'missing')),
  notes text,
  created_at timestamptz not null default now(),
  unique (library_entry_id, part_name)
);

-- =========
-- 3. Indexes
-- =========
create index if not exists idx_library_entry_org on library_entry(organization_id);
create index if not exists idx_library_entry_ref on library_entry(reference_work_id) where reference_work_id is not null;
create index if not exists idx_library_entry_part_entry on library_entry_part(library_entry_id);

-- =========
-- 4. Triggers
-- =========

-- Reuse update_updated_at() from 0001_init.sql
drop trigger if exists trg_library_entry_updated_at on library_entry;
create trigger trg_library_entry_updated_at before update on library_entry
for each row execute procedure update_updated_at();

-- =========
-- 5. RLS Policies
-- =========
alter table library_entry enable row level security;
alter table library_entry_part enable row level security;

-- library_entry: org members can SELECT
drop policy if exists select_library_entry_member on library_entry;
create policy select_library_entry_member on library_entry
for select using (is_org_member(organization_id));

-- library_entry: managers/owners can INSERT
drop policy if exists insert_library_entry_manager on library_entry;
create policy insert_library_entry_manager on library_entry
for insert with check (is_org_manager_or_owner(organization_id));

-- library_entry: managers/owners can UPDATE
drop policy if exists update_library_entry_manager on library_entry;
create policy update_library_entry_manager on library_entry
for update using (is_org_manager_or_owner(organization_id));

-- library_entry: managers/owners can DELETE
drop policy if exists delete_library_entry_manager on library_entry;
create policy delete_library_entry_manager on library_entry
for delete using (is_org_manager_or_owner(organization_id));

-- library_entry_part: org members can SELECT (via parent entry)
drop policy if exists select_library_entry_part_member on library_entry_part;
create policy select_library_entry_part_member on library_entry_part
for select using (
  exists (
    select 1 from library_entry
    where library_entry.id = library_entry_part.library_entry_id
      and is_org_member(library_entry.organization_id)
  )
);

-- library_entry_part: managers/owners can INSERT (via parent entry)
drop policy if exists insert_library_entry_part_manager on library_entry_part;
create policy insert_library_entry_part_manager on library_entry_part
for insert with check (
  exists (
    select 1 from library_entry
    where library_entry.id = library_entry_part.library_entry_id
      and is_org_manager_or_owner(library_entry.organization_id)
  )
);

-- library_entry_part: managers/owners can UPDATE (via parent entry)
drop policy if exists update_library_entry_part_manager on library_entry_part;
create policy update_library_entry_part_manager on library_entry_part
for update using (
  exists (
    select 1 from library_entry
    where library_entry.id = library_entry_part.library_entry_id
      and is_org_manager_or_owner(library_entry.organization_id)
  )
);

-- library_entry_part: managers/owners can DELETE (via parent entry)
drop policy if exists delete_library_entry_part_manager on library_entry_part;
create policy delete_library_entry_part_manager on library_entry_part
for delete using (
  exists (
    select 1 from library_entry
    where library_entry.id = library_entry_part.library_entry_id
      and is_org_manager_or_owner(library_entry.organization_id)
  )
);

-- =========
-- Done
-- =========
