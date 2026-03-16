// app/api/library/members/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { z } from "zod";

const OrgId = z.string().uuid();

// ---------------------------------------------------------------------------
// GET — List org members
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = req.nextUrl.searchParams.get("organization_id");

  if (!organizationId || !OrgId.safeParse(organizationId).success) {
    return NextResponse.json(
      { error: "Valid organization_id is required" },
      { status: 400 }
    );
  }

  // Verify user is a member of this org (any role can see member list)
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all org members
  const { data: members, error } = await supabase
    .from("org_member")
    .select("id, user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Batch-fetch user_profile rows for names
  const userIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("user_profile")
    .select("user_id, first_name, last_name")
    .in("user_id", userIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  // Build response with profile data
  const result = (members ?? []).map((m) => {
    const profile = profileMap.get(m.user_id);
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      created_at: m.created_at,
    };
  });

  return NextResponse.json({
    members: result,
    current_user_role: membership.role,
  });
}

// ---------------------------------------------------------------------------
// POST — Invite a member by email
// ---------------------------------------------------------------------------

const InvitePayload = z.object({
  organization_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["manager", "member"]),
});

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = InvitePayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { organization_id, email, role } = parsed.data;

  // Verify current user is owner or manager
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["owner", "manager"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Insufficient role for this action" },
      { status: 403 }
    );
  }

  // Look up user by email using admin client (requires service role key)
  let adminSupabase;
  try {
    adminSupabase = createAdminSupabase();
  } catch {
    return NextResponse.json(
      { error: "Email lookup is not configured. Contact your administrator." },
      { status: 500 }
    );
  }

  // Use the admin API to list users and find by email
  let targetUserId: string | null = null;

  const { data: listData } = await adminSupabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const found = listData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (found) {
    targetUserId = found.id;
  }

  if (!targetUserId) {
    return NextResponse.json(
      {
        error:
          "User not found. They must sign up for an account first before they can be invited.",
      },
      { status: 404 }
    );
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("org_member")
    .select("id")
    .eq("organization_id", organization_id)
    .eq("user_id", targetUserId)
    .single();

  if (existingMember) {
    return NextResponse.json(
      { error: "This user is already a member of this organization." },
      { status: 409 }
    );
  }

  // Insert new org_member
  const { data: newMember, error: insertError } = await supabase
    .from("org_member")
    .insert({
      organization_id,
      user_id: targetUserId,
      role,
      invited_by: user.id,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 400 }
    );
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "org_member",
    entity_id: newMember.id,
    actor_user_id: user.id,
    action: "invite",
    organization_id,
    snapshot: { ...newMember, invited_email: email },
  });

  return NextResponse.json({ ok: true, member: newMember });
}
