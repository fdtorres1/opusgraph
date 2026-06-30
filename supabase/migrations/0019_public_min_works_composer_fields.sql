-- Include public-safe composer names in the minimal public work list/search RPC.
-- This keeps public list and search cards unambiguous without exposing full work detail.

drop function if exists public_min_works(text, uuid);

create function public_min_works(q text default null, composer_id uuid default null)
returns table (
  id uuid,
  work_name text,
  composer_id uuid,
  composer_first_name text,
  composer_last_name text,
  public_tier public_work_tier
)
language sql stable security definer set search_path=public as $$
  select
    w.id,
    w.work_name,
    w.composer_id,
    c.first_name as composer_first_name,
    c.last_name as composer_last_name,
    w.public_tier
  from work w
  left join composer c on c.id = w.composer_id
  where w.public_tier in ('indexed','verified','canonical')
    and (composer_id is null or w.composer_id = composer_id)
    and (q is null or norm(w.work_name) like norm('%' || q || '%'))
  order by w.work_name
  limit 50;
$$;

revoke all on function public_min_works(text, uuid) from public;
grant execute on function public_min_works(text, uuid) to anon, authenticated;
