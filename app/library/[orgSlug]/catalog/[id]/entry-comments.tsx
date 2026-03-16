"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns/format";

type Comment = {
  id: string;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
  author: {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
  };
};

type Props = {
  entryId: string;
};

export default function EntryComments({ entryId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/library/entries/${entryId}/comments`);
    if (res.ok) {
      const json = await res.json();
      setComments(json.comments ?? []);
    }
    setLoading(false);
  }, [entryId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
    fetchComments();
  }, [fetchComments]);

  const authorName = (author: Comment["author"]) => {
    const parts = [author.first_name, author.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Unknown User";
  };

  const handleAddComment = async () => {
    if (!newCommentBody.trim() || submitting) return;
    setSubmitting(true);

    // Optimistic: add a temporary comment
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Comment = {
      id: optimisticId,
      body: newCommentBody.trim(),
      parent_comment_id: null,
      created_at: new Date().toISOString(),
      author: {
        user_id: currentUserId ?? "",
        first_name: null,
        last_name: null,
      },
    };
    setComments((prev) => [...prev, optimistic]);
    setNewCommentBody("");

    const res = await fetch(`/api/library/entries/${entryId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newCommentBody.trim() }),
    });

    if (res.ok) {
      await fetchComments();
    } else {
      // Revert optimistic update
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setNewCommentBody(optimistic.body);
    }
    setSubmitting(false);
  };

  const handleReply = async (parentId: string) => {
    if (!replyBody.trim() || submitting) return;
    setSubmitting(true);

    const res = await fetch(`/api/library/entries/${entryId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: replyBody.trim(),
        parent_comment_id: parentId,
      }),
    });

    if (res.ok) {
      setReplyingTo(null);
      setReplyBody("");
      await fetchComments();
    }
    setSubmitting(false);
  };

  const handleEdit = async (commentId: string) => {
    if (!editBody.trim() || submitting) return;
    setSubmitting(true);

    const res = await fetch(
      `/api/library/entries/${entryId}/comments/${commentId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody.trim() }),
      }
    );

    if (res.ok) {
      setEditingId(null);
      setEditBody("");
      await fetchComments();
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const res = await fetch(
      `/api/library/entries/${entryId}/comments/${commentId}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
    setDeleteTarget(null);
  };

  // Separate top-level comments from replies
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = comments.reduce(
    (acc, c) => {
      if (c.parent_comment_id) {
        if (!acc[c.parent_comment_id]) acc[c.parent_comment_id] = [];
        acc[c.parent_comment_id].push(c);
      }
      return acc;
    },
    {} as Record<string, Comment[]>
  );

  const renderComment = (comment: Comment, isReply: boolean) => {
    const isOwn = currentUserId === comment.author.user_id;
    const isEditing = editingId === comment.id;
    const isReplying = replyingTo === comment.id;

    return (
      <div
        key={comment.id}
        className={
          isReply
            ? "ml-8 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700"
            : ""
        }
      >
        <div className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
              {authorName(comment.author)}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>

          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleEdit(comment.id)}
                  disabled={submitting || !editBody.trim()}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setEditBody("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {comment.body}
            </p>
          )}

          {!isEditing && (
            <div className="flex gap-2 mt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-0.5 px-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                onClick={() => {
                  setReplyingTo(isReplying ? null : comment.id);
                  setReplyBody("");
                }}
              >
                Reply
              </Button>
              {isOwn && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0.5 px-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    onClick={() => {
                      setEditingId(comment.id);
                      setEditBody(comment.body);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto py-0.5 px-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    onClick={() => setDeleteTarget(comment.id)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}

          {isReplying && (
            <div className="mt-2 ml-4 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleReply(comment.id)}
                  disabled={submitting || !replyBody.trim()}
                >
                  Reply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyBody("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Render replies */}
        {repliesByParent[comment.id]?.map((reply) =>
          renderComment(reply, true)
        )}
      </div>
    );
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading comments...
            </p>
          ) : topLevel.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No comments yet. Be the first to leave a comment.
            </p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {topLevel.map((comment) => renderComment(comment, false))}
            </div>
          )}

          {/* Add comment form */}
          <div className="mt-6 space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={newCommentBody}
              onChange={(e) => setNewCommentBody(e.target.value)}
              rows={3}
            />
            <Button
              onClick={handleAddComment}
              disabled={submitting || !newCommentBody.trim()}
            >
              Add Comment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
