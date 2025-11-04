-- Add RLS policy for activity_event view
-- Views inherit RLS from underlying tables, but we need to ensure admins can read it

-- Grant access to activity_event view for contributors/admins
-- Since it's a view, we can't use RLS directly, but we can ensure the underlying tables have proper policies

-- The view is already accessible if the underlying tables (revision, admin_comment, review_flag) have read policies
-- which they do. This migration just ensures the view is explicitly accessible.

-- No additional policies needed - the view inherits access from the underlying tables
-- But we can add a comment for clarity
COMMENT ON VIEW activity_event IS 'Activity feed view combining revisions, comments, and review flags. Accessible to contributors and admins.';

