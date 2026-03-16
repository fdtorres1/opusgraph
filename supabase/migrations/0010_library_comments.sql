-- =========
-- 1. Library Comment Table
-- =========
create table if not exists library_comment (
  id uuid primary key default gen_random_uuid(),
  library_entry_id uuid not null references library_entry(id) on delete cascade,
  author_user_id uuid not null, -- auth.users id (no FK across schema for portability)
  body text not null,
  parent_comment_id uuid references library_comment(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- =========
-- 2. Indexes
-- =========
create index if not exists idx_library_comment_entry on library_comment(library_entry_id);
create index if not exists idx_library_comment_parent on library_comment(parent_comment_id) where parent_comment_id is not null;

-- =========
-- 3. RLS Policies
-- =========
alter table library_comment enable row level security;

-- SELECT: all org members can read comments on entries they can see
drop policy if exists select_library_comment_member on library_comment;
create policy select_library_comment_member on library_comment
for select using (
  exists (
    select 1 from library_entry
    where library_entry.id = library_comment.library_entry_id
      and is_org_member(library_entry.organization_id)
  )
);

-- INSERT: all org members (owner, manager, AND member) can create comments
drop policy if exists insert_library_comment_member on library_comment;
create policy insert_library_comment_member on library_comment
for insert with check (
  exists (
    select 1 from library_entry
    where library_entry.id = library_comment.library_entry_id
      and is_org_member(library_entry.organization_id)
  )
);

-- UPDATE: only the comment author can update their own comment
drop policy if exists update_library_comment_author on library_comment;
create policy update_library_comment_author on library_comment
for update using (author_user_id = auth.uid());

-- DELETE: only the comment author can delete their own comment
drop policy if exists delete_library_comment_author on library_comment;
create policy delete_library_comment_author on library_comment
for delete using (author_user_id = auth.uid());

-- =========
-- Done
-- =========
