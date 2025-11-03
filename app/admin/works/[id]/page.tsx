// app/admin/works/[id]/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import WorkEditor from "./work-editor";

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { id: paramId } = await params;
  const isNew = paramId === "new";

  let initial: any = null;
  let ensembles: { id: string; label: string }[] = [];

  const { data: ensemblesData } = await supabase.from("ensemble_type").select("id,label").order("label");
  ensembles = (ensemblesData ?? []).map(e => ({ id: e.id, label: e.label }));

  if (!isNew) {
    const { data } = await supabase
      .from("work")
      .select(`
        id, work_name, composition_year, composer_id, ensemble_id,
        instrumentation_text, duration_seconds, publisher_id, status,
        work_source(id, url, title, display_order),
        work_recording(id, url, provider, embed_url, display_order)
      `)
      .eq("id", paramId)
      .single();

    initial = data ?? null;
  }

  return (
    <div className="p-6">
      <WorkEditor initial={initial} isNew={isNew} ensembles={ensembles} />
    </div>
  );
}

