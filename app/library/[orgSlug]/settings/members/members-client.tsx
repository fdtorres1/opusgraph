"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Users, Loader2, Shield } from "lucide-react";
import { format } from "date-fns/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrgInfo = {
  id: string;
  slug: string;
  name: string;
  type: string;
  plan_tier: string;
};

type Member = {
  id: string;
  user_id: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleBadgeVariant(role: string) {
  switch (role) {
    case "owner":
      return "default" as const;
    case "manager":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function roleBadgeClass(role: string) {
  switch (role) {
    case "owner":
      return "bg-blue-600 text-white hover:bg-blue-700";
    case "manager":
      return "bg-green-600 text-white hover:bg-green-700";
    default:
      return "";
  }
}

function displayName(member: Member) {
  const parts = [member.first_name, member.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "Unknown User";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MembersClient({
  org,
  currentUserRole,
  currentUserId,
}: {
  org: OrgInfo;
  currentUserRole: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Role change state
  const [roleChangeTarget, setRoleChangeTarget] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [changingRole, setChangingRole] = useState(false);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isOwner = currentUserRole === "owner";

  // ---------------------------------------------------------------------------
  // Fetch members
  // ---------------------------------------------------------------------------

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/library/members?organization_id=${org.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ---------------------------------------------------------------------------
  // Invite member
  // ---------------------------------------------------------------------------

  function openInvite() {
    setInviteEmail("");
    setInviteRole("member");
    setInviteError(null);
    setInviteOpen(true);
  }

  async function handleInvite() {
    const trimmedEmail = inviteEmail.trim();
    if (!trimmedEmail) {
      setInviteError("Email is required.");
      return;
    }

    setInviting(true);
    setInviteError(null);

    try {
      const res = await fetch("/api/library/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: org.id,
          email: trimmedEmail,
          role: inviteRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setInviteError(data?.error ?? "Failed to invite member.");
        return;
      }

      setInviteOpen(false);
      await fetchMembers();
    } finally {
      setInviting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Change role
  // ---------------------------------------------------------------------------

  function openRoleChange(member: Member) {
    setRoleChangeTarget(member);
    setNewRole(member.role);
    setRoleChangeError(null);
  }

  async function handleRoleChange() {
    if (!roleChangeTarget || newRole === roleChangeTarget.role) {
      setRoleChangeTarget(null);
      return;
    }

    setChangingRole(true);
    setRoleChangeError(null);

    try {
      const res = await fetch(`/api/library/members/${roleChangeTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setRoleChangeError(data?.error ?? "Failed to change role.");
        return;
      }

      setRoleChangeTarget(null);
      await fetchMembers();
    } finally {
      setChangingRole(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Remove member
  // ---------------------------------------------------------------------------

  async function handleDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/library/members/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        await fetchMembers();
      }
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Members</h1>
          <p className="text-zinc-500 mt-1">
            Manage members of your organization.
          </p>
        </div>
        {isOwner && (
          <Button onClick={openInvite}>
            <Plus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && members.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-10 w-10 text-zinc-300 mb-4" />
            <p className="text-zinc-500 mb-4">No members found.</p>
          </CardContent>
        </Card>
      )}

      {/* Member list */}
      {!loading && members.length > 0 && (
        <div className="space-y-2">
          {members.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;

            return (
              <Card key={member.id} className="group">
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Avatar placeholder */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-medium text-sm">
                    {(member.first_name?.[0] ?? "?").toUpperCase()}
                  </div>

                  {/* Name + join date */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {displayName(member)}
                      {isCurrentUser && (
                        <span className="text-zinc-400 text-sm ml-2">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Joined{" "}
                      {format(new Date(member.created_at), "MMM d, yyyy")}
                    </p>
                  </div>

                  {/* Role badge */}
                  <Badge
                    variant={roleBadgeVariant(member.role)}
                    className={roleBadgeClass(member.role)}
                  >
                    {member.role.charAt(0).toUpperCase() +
                      member.role.slice(1)}
                  </Badge>

                  {/* Actions — only for owners, and not for self */}
                  {isOwner && !isCurrentUser && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openRoleChange(member)}
                        title="Change role"
                      >
                        <Shield className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(member)}
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
            <DialogDescription>
              Invite a user to join your organization. They must have an
              existing account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleInvite();
                  }
                }}
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    Member — Read-only access, can comment
                  </SelectItem>
                  <SelectItem value="manager">
                    Manager — Full library CRUD, can invite users
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error */}
            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role change dialog */}
      <Dialog
        open={!!roleChangeTarget}
        onOpenChange={(open) => {
          if (!open) setRoleChangeTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change the role for {roleChangeTarget ? displayName(roleChangeTarget) : ""}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    Owner — Full org control
                  </SelectItem>
                  <SelectItem value="manager">
                    Manager — Library CRUD, can invite
                  </SelectItem>
                  <SelectItem value="member">
                    Member — Read-only, can comment
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Error */}
            {roleChangeError && (
              <p className="text-sm text-destructive">{roleChangeError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleChangeTarget(null)}
              disabled={changingRole}
            >
              Cancel
            </Button>
            <Button onClick={handleRoleChange} disabled={changingRole}>
              {changingRole && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {deleteTarget ? displayName(deleteTarget) : ""} from this
              organization? They will lose access to all organization data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
