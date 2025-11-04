// app/admin/composers/[id]/page.tsx
import { createServerSupabase } from "@/lib/supabase/server";
import ComposerEditor from "./composer-editor";

export default async function ComposerPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabase();
  const { id: paramId } = await params;
  const isNew = paramId === "new";

  let initial: any = null;
  let genders: { id: string; label: string }[] = [];
  let countries: { iso2: string; name: string }[] = [];

  const { data: gendersData } = await supabase.from("gender_identity").select("id,label").order("label");
  genders = (gendersData ?? []).map(g => ({ id: g.id, label: g.label }));

  const { data: countriesData } = await supabase.from("country").select("iso2,name").order("name");
  countries = (countriesData ?? []).map(c => ({ iso2: c.iso2, name: c.name }));

  if (!isNew) {
    const { data } = await supabase
      .from("composer")
      .select(`
        id, first_name, last_name, birth_year, birth_place_id,
        death_year, death_place_id, gender_id, gender_self_describe, status,
        composer_link(id, url, is_primary, display_order),
        composer_nationality(country_iso2)
      `)
      .eq("id", paramId)
      .single();

    initial = data ?? null;
  }

  return (
    <div className="p-6">
      <ComposerEditor initial={initial} isNew={isNew} genders={genders} countries={countries} />
    </div>
  );
}

