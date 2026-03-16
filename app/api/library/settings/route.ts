// app/api/library/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { OrganizationPayload } from "@/lib/validators/organization";
import { z } from "zod";

const OrgId = z.string().uuid();

/**
 * GET /api/library/settings?organization_id=...
 * Returns full org details for the settings page.
 */
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

  // Verify user is a member
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: org, error } = await supabase
    .from("organization")
    .select("id, slug, name, type, plan_tier, created_at")
    .eq("id", organizationId)
    .single();

  if (error || !org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ org });
}

/**
 * PATCH /api/library/settings
 * Update organization name and type. Owner only.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { organization_id } = body;

  if (!organization_id || !OrgId.safeParse(organization_id).success) {
    return NextResponse.json(
      { error: "Valid organization_id is required" },
      { status: 400 }
    );
  }

  // Verify user is owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can update organization settings" },
      { status: 403 }
    );
  }

  // Validate name and type
  const parsed = OrganizationPayload.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Fetch current org to check if name changed
  const { data: currentOrg } = await supabase
    .from("organization")
    .select("name, slug")
    .eq("id", organization_id)
    .single();

  if (!currentOrg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateFields: Record<string, unknown> = {
    name: parsed.data.name,
    type: parsed.data.type,
  };

  // If name changed, regenerate slug using the DB function
  if (parsed.data.name !== currentOrg.name) {
    // Call the database generate_slug function
    const { data: slugResult } = await supabase.rpc("generate_slug", {
      name: parsed.data.name,
    });
    if (slugResult) {
      updateFields.slug = slugResult;
    }
  }

  const { data: updated, error: upErr } = await supabase
    .from("organization")
    .update(updateFields)
    .eq("id", organization_id)
    .select("id, slug, name, type, plan_tier, created_at")
    .single();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "organization",
    entity_id: organization_id,
    actor_user_id: user.id,
    action: "update",
    organization_id,
    snapshot: updated,
  });

  return NextResponse.json({ ok: true, org: updated });
}

/**
 * DELETE /api/library/settings
 * Delete the organization. Owner only. Cascade handles everything.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { organization_id } = body;

  if (!organization_id || !OrgId.safeParse(organization_id).success) {
    return NextResponse.json(
      { error: "Valid organization_id is required" },
      { status: 400 }
    );
  }

  // Verify user is owner
  const { data: membership } = await supabase
    .from("org_member")
    .select("role")
    .eq("organization_id", organization_id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (membership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can delete an organization" },
      { status: 403 }
    );
  }

  // Fetch org before deletion for the revision snapshot
  const { data: org } = await supabase
    .from("organization")
    .select("*")
    .eq("id", organization_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete organization (cascade handles members, entries, etc.)
  const { error: deleteError } = await supabase
    .from("organization")
    .delete()
    .eq("id", organization_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  // Log revision
  await supabase.from("revision").insert({
    entity_type: "organization",
    entity_id: organization_id,
    actor_user_id: user.id,
    action: "delete",
    organization_id,
    snapshot: org,
  });

  return NextResponse.json({ ok: true, message: "Organization deleted" });
}
