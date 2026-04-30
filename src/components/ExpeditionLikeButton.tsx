"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ExpeditionLikeButton({
  expeditionId,
  initialCount,
  initiallyLiked,
  canLike,
}: {
  expeditionId: string;
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

    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));

    startTransition(async () => {
      if (liked) {
        await supabase
          .from("expedition_likes")
          .delete()
          .eq("expedition_id", expeditionId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("expedition_likes")
          .insert({ expedition_id: expeditionId, user_id: user.id });
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
