// app/admin/review/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { ReviewQueue } from "./review-queue";

export default async function ReviewPage() {
  const supabase = await createServerSupabase();
  
  // Fetch all review flags with entity names
  const { data: flags } = await supabase
    .from("review_flag")
    .select(`
      id, reason, status, created_at, details,
      entity_type, entity_id
    `)
    .order("created_at", { ascending: false });

  // Fetch entity names for composers and works
  const composerIds = flags?.filter(f => f.entity_type === "composer").map(f => f.entity_id) || [];
  const workIds = flags?.filter(f => f.entity_type === "work").map(f => f.entity_id) || [];

  const composers = composerIds.length > 0
    ? await supabase
        .from("composer")
        .select("id, first_name, last_name")
        .in("id", composerIds)
    : { data: [] };

  const works = workIds.length > 0
    ? await supabase
        .from("work")
        .select("id, work_name")
        .in("id", workIds)
    : { data: [] };

  // Map entity names to flags
  const flagsWithNames = flags?.map(flag => {
    let entity_name: string | undefined;
    if (flag.entity_type === "composer") {
      const composer = composers.data?.find(c => c.id === flag.entity_id);
      entity_name = composer ? `${composer.first_name} ${composer.last_name}` : undefined;
    } else {
      const work = works.data?.find(w => w.id === flag.entity_id);
      entity_name = work?.work_name || undefined;
    }

    // Extract duplicate IDs from details if present
    let duplicate_ids: string[] | undefined;
    if (flag.details && typeof flag.details === "object" && "duplicate_ids" in flag.details) {
      duplicate_ids = (flag.details as any).duplicate_ids;
    }

    return {
      ...flag,
      entity_name,
      duplicate_ids,
    };
  }) || [];

  return <ReviewQueue initialFlags={flagsWithNames} />;
}
