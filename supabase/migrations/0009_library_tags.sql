-- =========
-- 1. library_tag table
-- =========
create table if not exists library_tag (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  name text not null,
  category text,
  color text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- =========
-- 2. library_entry_tag join table
-- =========
create table if not exists library_entry_tag (
  library_entry_id uuid not null references library_entry(id) on delete cascade,
  library_tag_id uuid not null references library_tag(id) on delete cascade,
  primary key (library_entry_id, library_tag_id)
);

-- =========
-- 3. RLS Policies — library_tag
-- =========
alter table library_tag enable row level security;

-- SELECT: org members can read tags
drop policy if exists select_library_tag_member on library_tag;
create policy select_library_tag_member on library_tag
for select using (is_org_member(organization_id));

-- INSERT: managers/owners can create tags
drop policy if exists insert_library_tag_manager on library_tag;
create policy insert_library_tag_manager on library_tag
for insert with check (is_org_manager_or_owner(organization_id));

-- UPDATE: managers/owners can update tags
drop policy if exists update_library_tag_manager on library_tag;
create policy update_library_tag_manager on library_tag
for update using (is_org_manager_or_owner(organization_id));

-- DELETE: managers/owners can delete tags
drop policy if exists delete_library_tag_manager on library_tag;
create policy delete_library_tag_manager on library_tag
for delete using (is_org_manager_or_owner(organization_id));

-- =========
-- 4. RLS Policies — library_entry_tag
-- =========
alter table library_entry_tag enable row level security;

-- SELECT: org members can read (derived via library_entry's organization_id)
drop policy if exists select_library_entry_tag_member on library_entry_tag;
create policy select_library_entry_tag_member on library_entry_tag
for select using (
  exists (
    select 1 from library_entry
    where library_entry.id = library_entry_tag.library_entry_id
      and is_org_member(library_entry.organization_id)
  )
);

-- INSERT: managers/owners can assign tags
drop policy if exists insert_library_entry_tag_manager on library_entry_tag;
create policy insert_library_entry_tag_manager on library_entry_tag
for insert with check (
  exists (
    select 1 from library_entry
    where library_entry.id = library_entry_tag.library_entry_id
      and is_org_manager_or_owner(library_entry.organization_id)
  )
);

-- DELETE: managers/owners can remove tags
drop policy if exists delete_library_entry_tag_manager on library_entry_tag;
create policy delete_library_entry_tag_manager on library_entry_tag
for delete using (
  exists (
    select 1 from library_entry
    where library_entry.id = library_entry_tag.library_entry_id
      and is_org_manager_or_owner(library_entry.organization_id)
  )
);

-- =========
-- Done
-- =========
