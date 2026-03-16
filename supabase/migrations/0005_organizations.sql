-- =========
-- 0. Enum Types
-- =========
do $$ begin
  create type org_type as enum ('orchestra','choir','band','church','school','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type org_role as enum ('owner','manager','member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_tier as enum ('free','starter','professional');
exception when duplicate_object then null; end $$;

-- =========
-- 1. Slug Generator
-- =========
create or replace function generate_slug(name text) returns text
language sql volatile as $$
  select
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(coalesce(name, '')),
          '[^a-z0-9 -]', '', 'g'         -- strip non-alphanumeric (keep spaces and hyphens)
        ),
        '[ -]+', '-', 'g'               -- collapse spaces/hyphens into single hyphen
      ),
      '^-+|-+$', '', 'g'                -- trim leading/trailing hyphens
    )
    || '-' || substr(md5(random()::text), 1, 6);
$$;

-- =========
-- 2. Organization Table
-- =========
create table if not exists organization (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null default '',
  type org_type not null default 'other',
  plan_tier plan_tier not null default 'free',
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_organization_slug on organization(slug);
create index if not exists idx_organization_stripe on organization(stripe_customer_id) where stripe_customer_id is not null;

-- =========
-- 3. Org Member Table
-- =========
create table if not exists org_member (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  user_id uuid not null,
  role org_role not null default 'member',
  invited_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- =========
-- 4. Triggers
-- =========

-- Reuse update_updated_at() from 0001_init.sql
drop trigger if exists trg_organization_updated_at on organization;
create trigger trg_organization_updated_at before update on organization
for each row execute procedure update_updated_at();

-- Auto-generate slug on INSERT when slug is null or the default placeholder
create or replace function set_organization_slug() returns trigger
language plpgsql as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := generate_slug(new.name);
  end if;
  return new;
end; $$;

drop trigger if exists trg_organization_set_slug on organization;
create trigger trg_organization_set_slug before insert on organization
for each row execute procedure set_organization_slug();

-- Ensure at least one owner per organization
create or replace function ensure_one_owner() returns trigger
language plpgsql as $$
declare
  owner_count int;
begin
  -- On DELETE: check if we're removing an owner
  if tg_op = 'DELETE' then
    if old.role = 'owner' then
      select count(*) into owner_count
      from org_member
      where organization_id = old.organization_id
        and role = 'owner'
        and id <> old.id;
      if owner_count = 0 then
        raise exception 'Cannot remove the last owner of an organization';
      end if;
    end if;
    return old;
  end if;

  -- On UPDATE: check if we're demoting an owner
  if tg_op = 'UPDATE' then
    if old.role = 'owner' and new.role <> 'owner' then
      select count(*) into owner_count
      from org_member
      where organization_id = old.organization_id
        and role = 'owner'
        and id <> old.id;
      if owner_count = 0 then
        raise exception 'Cannot demote the last owner of an organization';
      end if;
    end if;
    return new;
  end if;

  return new;
end; $$;

drop trigger if exists trg_ensure_one_owner on org_member;
create trigger trg_ensure_one_owner before delete or update on org_member
for each row execute procedure ensure_one_owner();

-- =========
-- 5. Helper Functions (for RLS)
-- =========
create or replace function is_org_member(p_org_id uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from org_member
    where organization_id = p_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function is_org_manager_or_owner(p_org_id uuid) returns boolean
language sql stable as $$
  select exists (
    select 1 from org_member
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role in ('owner','manager')
  );
$$;

-- =========
-- 6. RLS Policies
-- =========
alter table organization enable row level security;
alter table org_member enable row level security;

-- Organization policies
drop policy if exists select_organization_member on organization;
create policy select_organization_member on organization
for select using (is_org_member(id));

drop policy if exists insert_organization_authenticated on organization;
create policy insert_organization_authenticated on organization
for insert with check (auth.uid() is not null);

drop policy if exists update_organization_owner on organization;
create policy update_organization_owner on organization
for update using (
  exists (
    select 1 from org_member
    where organization_id = id
      and user_id = auth.uid()
      and role = 'owner'
  )
);

drop policy if exists delete_organization_owner on organization;
create policy delete_organization_owner on organization
for delete using (
  exists (
    select 1 from org_member
    where organization_id = id
      and user_id = auth.uid()
      and role = 'owner'
  )
);

-- Org member policies
drop policy if exists select_org_member_member on org_member;
create policy select_org_member_member on org_member
for select using (is_org_member(organization_id));

drop policy if exists insert_org_member_manager on org_member;
create policy insert_org_member_manager on org_member
for insert with check (is_org_manager_or_owner(organization_id));

drop policy if exists update_org_member_owner on org_member;
create policy update_org_member_owner on org_member
for update using (
  exists (
    select 1 from org_member om
    where om.organization_id = org_member.organization_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  )
);

drop policy if exists delete_org_member_owner on org_member;
create policy delete_org_member_owner on org_member
for delete using (
  exists (
    select 1 from org_member om
    where om.organization_id = org_member.organization_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  )
);

-- =========
-- 7. Auto-create Personal Org on Signup
-- =========

-- Extend the existing handle_new_user() trigger function to also create a personal org
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  new_org_id uuid;
begin
  -- Create user profile (original behavior from 0002)
  insert into public.user_profile (user_id, admin_role)
  values (new.id, 'none')
  on conflict (user_id) do nothing;

  -- Create personal organization
  new_org_id := gen_random_uuid();
  insert into public.organization (id, name, slug, type, plan_tier)
  values (new_org_id, 'My Library', generate_slug('my-library'), 'other', 'free');

  -- Add user as owner of personal org
  insert into public.org_member (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

-- =========
-- 8. Backfill: Create Personal Orgs for Existing Users
-- =========

-- For existing auth users who don't have a personal org yet, create one
do $$
declare
  r record;
  new_org_id uuid;
begin
  for r in
    select u.id as user_id
    from auth.users u
    where not exists (
      select 1 from org_member om
      where om.user_id = u.id
    )
  loop
    new_org_id := gen_random_uuid();
    insert into organization (id, name, slug, type, plan_tier)
    values (new_org_id, 'My Library', generate_slug('my-library'), 'other', 'free');

    insert into org_member (organization_id, user_id, role)
    values (new_org_id, r.user_id, 'owner');
  end loop;
end;
$$;

-- =========
-- Done
-- =========
