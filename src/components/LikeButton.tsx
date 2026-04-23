"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LikeButton({
  photoId,
  initialCount,
  initiallyLiked,
  canLike,
}: {
  photoId: string;
  initialCount: number;
  initiallyLiked: boolean;
  canLike: boolean;
}) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    if (!canLike) {
      window.location.href = "/login";
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Optimistic
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));

    startTransition(async () => {
      if (liked) {
        await supabase
          .from("likes")
          .delete()
          .eq("photo_id", photoId)
          .eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ photo_id: photoId, user_id: user.id });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        liked ? "bg-red-50 border-red-300 text-red-700" : "bg-white"
      }`}
    >
      {liked ? "♥" : "♡"} {count}
    </button>
  );
}
