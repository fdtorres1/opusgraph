// app/api/places/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

type PlaceResult = {
  id: string;
  description: string;
  city?: string;
  admin_area?: string;
  country_iso2?: string;
  lat?: number;
  lon?: number;
  provider?: string;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");
    const provider = searchParams.get("provider") || "google";

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const supabase = await createServerSupabase();

    // Check cache first
    const { data: cached } = await supabase
      .from("place")
      .select("*")
      .ilike("label", `%${query}%`)
      .limit(10);

    if (cached && cached.length > 0) {
      return NextResponse.json({
        results: cached.map(p => ({
          id: p.id,
          description: p.label,
          city: p.city,
          admin_area: p.admin_area,
          country_iso2: p.country_iso2,
          lat: p.lat,
          lon: p.lon,
          provider: p.provider,
        })),
      });
    }

    // Try Google Places first if API key is available
    if (provider === "google" && process.env.GOOGLE_PLACES_API_KEY) {
      try {
        const googleRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}&types=(cities)`
        );

        if (googleRes.ok) {
          const googleData = await googleRes.json();
          if (googleData.predictions && googleData.predictions.length > 0) {
            const results: PlaceResult[] = [];

            // Fetch place details for each prediction
            for (const prediction of googleData.predictions.slice(0, 5)) {
              try {
                const detailsRes = await fetch(
                  `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&key=${process.env.GOOGLE_PLACES_API_KEY}&fields=place_id,name,geometry,address_components,formatted_address`
                );

                if (detailsRes.ok) {
                  const detailsData = await detailsRes.json();
                  const place = detailsData.result;
                  const addressComponents = place.address_components || [];

                  // Extract location components
                  let city: string | undefined;
                  let adminArea: string | undefined;
                  let countryIso2: string | undefined;

                  for (const component of addressComponents) {
                    if (component.types.includes("locality")) {
                      city = component.long_name;
                    } else if (component.types.includes("administrative_area_level_1")) {
                      adminArea = component.long_name;
                    } else if (component.types.includes("country")) {
                      countryIso2 = component.short_name;
                    }
                  }

                  // Store in database
                  const { data: savedPlace, error } = await supabase
                    .from("place")
                    .upsert({
                      provider: "google",
                      provider_place_id: place.place_id,
                      city: city || null,
                      admin_area: adminArea || null,
                      country_iso2: countryIso2 || null,
                      lat: place.geometry?.location?.lat || null,
                      lon: place.geometry?.location?.lng || null,
                      label: place.formatted_address || prediction.description,
                    }, {
                      onConflict: "provider,provider_place_id",
                    })
                    .select()
                    .single();

                  if (!error && savedPlace) {
                    results.push({
                      id: savedPlace.id,
                      description: savedPlace.label,
                      city: savedPlace.city || undefined,
                      admin_area: savedPlace.admin_area || undefined,
                      country_iso2: savedPlace.country_iso2 || undefined,
                      lat: savedPlace.lat || undefined,
                      lon: savedPlace.lon || undefined,
                      provider: savedPlace.provider,
                    });
                  }
                }
              } catch (error) {
                console.error("Error fetching place details:", error);
              }
            }

            if (results.length > 0) {
              return NextResponse.json({ results });
            }
          }
        }
      } catch (error) {
        console.error("Google Places API error:", error);
        // Fall through to Nominatim
      }
    }

    // Fallback to Nominatim (OpenStreetMap)
    // Note: Nominatim requires a User-Agent header and has rate limits
    try {
      const nominatimRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
        {
          headers: {
            "User-Agent": "OpusGraph/1.0 (https://opusgraph.vercel.app)",
          },
        }
      );

      if (nominatimRes.ok) {
        const nominatimData = await nominatimRes.json();
        const results: PlaceResult[] = [];

        for (const item of nominatimData) {
          const address = item.address || {};
          const city = address.city || address.town || address.village || address.municipality;
          const adminArea = address.state || address.province;
          const countryIso2 = address.country_code?.toUpperCase();

          // Store in database
          const { data: savedPlace, error } = await supabase
            .from("place")
            .upsert({
              provider: "osm",
              provider_place_id: String(item.place_id),
              city: city || null,
              admin_area: adminArea || null,
              country_iso2: countryIso2 || null,
              lat: parseFloat(item.lat) || null,
              lon: parseFloat(item.lon) || null,
              label: item.display_name,
            }, {
              onConflict: "provider,provider_place_id",
            })
            .select()
            .single();

          if (!error && savedPlace) {
            results.push({
              id: savedPlace.id,
              description: savedPlace.label,
              city: savedPlace.city || undefined,
              admin_area: savedPlace.admin_area || undefined,
              country_iso2: savedPlace.country_iso2 || undefined,
              lat: savedPlace.lat || undefined,
              lon: savedPlace.lon || undefined,
              provider: savedPlace.provider,
            });
          }
        }

        return NextResponse.json({ results });
      }
    } catch (error) {
      console.error("Nominatim API error:", error);
    }

    return NextResponse.json({ results: [] });
  } catch (error) {
    console.error("Error in /api/places:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

