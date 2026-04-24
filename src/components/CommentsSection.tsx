"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Comment = {
  id: string;
  body: string;
  created_at: string;
  author: { username: string | null; display_name: string | null } | null;
};

export default function CommentsSection({
  photoId,
  canPost,
}: {
  photoId: string;
  canPost: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("comments")
      .select(
        "id, body, created_at, author:profiles!comments_author_id_fkey(username, display_name)",
      )
      .eq("photo_id", photoId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    setComments((data as unknown as Comment[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [photoId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return;
    }

    const { error } = await supabase
      .from("comments")
      .insert({ photo_id: photoId, author_id: user.id, body });
    if (!error) {
      setBody("");
      await load();
    }
    setBusy(false);
  }

  return (
    <div>
      {canPost && (
        <form onSubmit={submit} className="mb-6 flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            Post
          </button>
        </form>
      )}

      <ul className="space-y-4">
        {comments.map((c) => (
          <li key={c.id} className="border-b pb-3">
            <p className="text-sm text-gray-600">
              {c.author?.username ? (
                <Link href={`/profile/${c.author.username}`} className="hover:underline">
                  @{c.author.username}
                </Link>
              ) : (
                "@unknown"
              )}{" "}
              · {new Date(c.created_at).toLocaleString()}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
        {comments.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
      </ul>
    </div>
  );
}
