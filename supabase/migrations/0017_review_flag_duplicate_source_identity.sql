create unique index if not exists review_flag_open_possible_duplicate_source_identity_uidx
on review_flag (
  entity_type,
  entity_id,
  ((details -> 'source_identity' ->> 'source')),
  ((coalesce(
    details -> 'source_identity' ->> 'source_entity_kind',
    details -> 'source_identity' ->> 'sourceEntityKind'
  ))),
  ((coalesce(
    details -> 'source_identity' ->> 'source_id',
    details -> 'source_identity' ->> 'sourceId'
  )))
)
where reason = 'possible_duplicate'
  and status = 'open'
  and jsonb_typeof(details -> 'source_identity') = 'object'
  and coalesce(details -> 'source_identity' ->> 'source', '') <> ''
  and coalesce(
    details -> 'source_identity' ->> 'source_entity_kind',
    details -> 'source_identity' ->> 'sourceEntityKind',
    ''
  ) <> ''
  and coalesce(
    details -> 'source_identity' ->> 'source_id',
    details -> 'source_identity' ->> 'sourceId',
    ''
  ) <> '';
