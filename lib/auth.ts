// lib/auth.ts
// Helper functions for authentication and authorization

import { createServerSupabase } from "@/lib/supabase/server";

export type AdminRole = "super_admin" | "admin" | "contributor" | "none";

/**
 * Get the admin role for the current user
 * Returns null if user is not authenticated or has no profile
 */
export async function getUserAdminRole(): Promise<AdminRole | null> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("user_profile")
    .select("admin_role")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return null;
  }

  return (profile.admin_role as AdminRole) || "none";
}

/**
 * Check if the current user has contributor role or above
 */
export async function isContributorOrAbove(): Promise<boolean> {
  const role = await getUserAdminRole();
  return role === "super_admin" || role === "admin" || role === "contributor";
}

/**
 * Check if the current user has admin role or above
 */
export async function isAdminOrAbove(): Promise<boolean> {
  const role = await getUserAdminRole();
  return role === "super_admin" || role === "admin";
}

/**
 * Check if the current user is an Individual (no admin access)
 */
export async function isIndividual(): Promise<boolean> {
  const role = await getUserAdminRole();
  return role === "none" || role === null;
}

