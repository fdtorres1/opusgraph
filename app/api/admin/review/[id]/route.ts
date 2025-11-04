// app/api/admin/review/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase();
    const { id } = await params;
    const { action } = await req.json();

    if (!action || !["resolve", "dismiss"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'resolve' or 'dismiss'" },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update the review flag
    const status = action === "resolve" ? "resolved" : "dismissed";
    const { data, error } = await supabase
      .from("review_flag")
      .update({
        status,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating review flag:", error);
      return NextResponse.json(
        { error: "Failed to update review flag" },
        { status: 500 }
      );
    }

    return NextResponse.json({ flag: data });
  } catch (error) {
    console.error("Error in PATCH /api/admin/review/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

