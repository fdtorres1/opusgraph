-- Migration: Add indexes and optimize search functions for performance
-- This improves search speed by indexing the columns used in LIKE queries

-- Enable required extensions
create extension if not exists pg_trgm with schema public;

-- Create immutable wrapper for unaccent function (required for indexes)
-- The unaccent extension is enabled, so we create an immutable wrapper
-- This allows us to use unaccent in index expressions
-- Note: We use the existing unaccent() function which should be available via the extension
create or replace function unaccent_immutable(text)
returns text
language sql
immutable
strict
as $$
  select public.unaccent($1);
$$;

-- Create trigram indexes using unaccent_immutable for better search matching
-- Index for composer name search (using trigram for better LIKE performance)
create index if not exists composer_name_search_idx 
  on composer using gin (unaccent_immutable(lower(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) gin_trgm_ops);

-- Index for work name search
create index if not exists work_name_search_idx 
  on work using gin (unaccent_immutable(lower(work_name)) gin_trgm_ops);

-- Partial index on status for faster filtering (composers - only published)
create index if not exists composer_status_idx on composer(status) where status = 'published';

-- Partial index on public tier for faster filtering (works - public tiers only)
create index if not exists work_public_tier_idx
  on work(public_tier)
  where public_tier in ('indexed','verified','canonical');

-- Composite index for work search with composer filtering
create index if not exists work_composer_public_tier_idx
  on work(composer_id, public_tier)
  where public_tier in ('indexed','verified','canonical');

-- Update search functions to add LIMIT and ORDER BY for better performance
create or replace function public_min_composers(q text default null)
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path=public as $$
  select c.id, c.first_name, c.last_name
  from composer c
  where (
      c.status = 'published'
      or exists (
        select 1
        from work w
        where w.composer_id = c.id
          and w.public_tier in ('indexed','verified','canonical')
      )
    )
    and (q is null or unaccent_immutable(lower(c.first_name || ' ' || c.last_name)) like unaccent_immutable(lower('%' || q || '%')))
  order by c.last_name, c.first_name
  limit 50;
$$;

create or replace function public_min_works(q text default null, composer_id uuid default null)
returns table (id uuid, work_name text, composer_id uuid, public_tier public_work_tier)
language sql stable security definer set search_path=public as $$
  select w.id, w.work_name, w.composer_id, w.public_tier
  from work w
  where w.public_tier in ('indexed','verified','canonical')
    and (composer_id is null or w.composer_id = composer_id)
    and (q is null or unaccent_immutable(lower(w.work_name)) like unaccent_immutable(lower('%' || q || '%')))
  order by w.work_name
  limit 50;
$$;
