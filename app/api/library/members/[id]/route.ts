// app/api/library/members/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const Id = z.string().uuid();

// ---------------------------------------------------------------------------
// PATCH — Change member role
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    Id.parse(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch the org_member record
  const { data: member } = await supabase
    .from("org_member")
    .select("id, organization_id, user_id, role")
    .eq("id", id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Verify current user is an owner of this org
  const { data: currentMembership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", member.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!currentMembership || currentMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can change member roles" },
      { status: 403 }
    );
  }

  // Parse request body
  const body = await req.json();
  const RolePayload = z.object({
    role: z.enum(["owner", "manager", "member"]),
  });

  const parsed = RolePayload.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid role. Must be one of: owner, manager, member" },
      { status: 400 }
    );
  }

  const { role: newRole } = parsed.data;

  // If demoting from owner, check that they're not the last owner
  if (member.role === "owner" && newRole !== "owner") {
    const { count } = await supabase
      .from("org_member")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", member.organization_id)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot demote the last owner of the organization" },
        { status: 400 }
      );
    }
  }

  const previousRole = member.role;

  // Update role
  const { data: updated, error } = await supabase
    .from("org_member")
    .update({ role: newRole })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    // The DB trigger also prevents demoting the last owner
    if (error.message?.includes("last owner")) {
      return NextResponse.json(
        { error: "Cannot demote the last owner of the organization" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "org_member",
    entity_id: id,
    actor_user_id: user.id,
    action: "role_change",
    organization_id: member.organization_id,
    snapshot: { ...updated, previous_role: previousRole },
  });

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// DELETE — Remove a member
// ---------------------------------------------------------------------------

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    Id.parse(id);
  } catch {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Fetch the org_member record
  const { data: member } = await supabase
    .from("org_member")
    .select("id, organization_id, user_id, role")
    .eq("id", id)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Verify current user is an owner of this org
  const { data: currentMembership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", member.organization_id)
    .eq("user_id", user.id)
    .single();

  if (!currentMembership || currentMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can remove members" },
      { status: 403 }
    );
  }

  // Can't remove the last owner
  if (member.role === "owner") {
    const { count } = await supabase
      .from("org_member")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", member.organization_id)
      .eq("role", "owner");

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last owner of the organization" },
        { status: 400 }
      );
    }
  }

  // Delete org_member row
  const { error } = await supabase
    .from("org_member")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.message?.includes("last owner")) {
      return NextResponse.json(
        { error: "Cannot remove the last owner of the organization" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "org_member",
    entity_id: id,
    actor_user_id: user.id,
    action: "remove",
    organization_id: member.organization_id,
    snapshot: member,
  });

  return NextResponse.json({ ok: true, message: "Member removed" });
}
