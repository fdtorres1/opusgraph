-- =========
-- 1. Performance Table
-- =========
create table if not exists performance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  date date not null,
  event_name text not null,
  venue text,
  season text,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========
-- 2. Performance Work Join Table
-- =========
create table if not exists performance_work (
  id uuid primary key default gen_random_uuid(),
  performance_id uuid not null references performance(id) on delete cascade,
  library_entry_id uuid not null references library_entry(id) on delete cascade,
  program_order integer not null,
  notes text,
  unique (performance_id, library_entry_id),
  unique (performance_id, program_order)
);

-- =========
-- 3. Indexes
-- =========
create index if not exists idx_performance_org on performance(organization_id);
create index if not exists idx_performance_date on performance(organization_id, date desc);
create index if not exists idx_performance_work_perf on performance_work(performance_id);
create index if not exists idx_performance_work_entry on performance_work(library_entry_id);

-- =========
-- 4. Triggers
-- =========

-- Reuse update_updated_at() from 0001_init.sql
drop trigger if exists trg_performance_updated_at on performance;
create trigger trg_performance_updated_at before update on performance
for each row execute procedure update_updated_at();

-- =========
-- 5. RLS Policies
-- =========
alter table performance enable row level security;
alter table performance_work enable row level security;

-- performance: org members can SELECT
drop policy if exists select_performance_member on performance;
create policy select_performance_member on performance
for select using (is_org_member(organization_id));

-- performance: managers/owners can INSERT
drop policy if exists insert_performance_manager on performance;
create policy insert_performance_manager on performance
for insert with check (is_org_manager_or_owner(organization_id));

-- performance: managers/owners can UPDATE
drop policy if exists update_performance_manager on performance;
create policy update_performance_manager on performance
for update using (is_org_manager_or_owner(organization_id));

-- performance: managers/owners can DELETE
drop policy if exists delete_performance_manager on performance;
create policy delete_performance_manager on performance
for delete using (is_org_manager_or_owner(organization_id));

-- performance_work: org members can SELECT (via parent performance)
drop policy if exists select_performance_work_member on performance_work;
create policy select_performance_work_member on performance_work
for select using (
  exists (
    select 1 from performance
    where performance.id = performance_work.performance_id
      and is_org_member(performance.organization_id)
  )
);

-- performance_work: managers/owners can INSERT (via parent performance)
drop policy if exists insert_performance_work_manager on performance_work;
create policy insert_performance_work_manager on performance_work
for insert with check (
  exists (
    select 1 from performance
    where performance.id = performance_work.performance_id
      and is_org_manager_or_owner(performance.organization_id)
  )
);

-- performance_work: managers/owners can UPDATE (via parent performance)
drop policy if exists update_performance_work_manager on performance_work;
create policy update_performance_work_manager on performance_work
for update using (
  exists (
    select 1 from performance
    where performance.id = performance_work.performance_id
      and is_org_manager_or_owner(performance.organization_id)
  )
);

-- performance_work: managers/owners can DELETE (via parent performance)
drop policy if exists delete_performance_work_manager on performance_work;
create policy delete_performance_work_manager on performance_work
for delete using (
  exists (
    select 1 from performance
    where performance.id = performance_work.performance_id
      and is_org_manager_or_owner(performance.organization_id)
  )
);

-- =========
-- Done
-- =========
