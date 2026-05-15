"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { HeartIcon, HeartFilledIcon } from "@radix-ui/react-icons";

const CONFIG = {
  photo: { table: "likes", idColumn: "photo_id" },
  expedition: { table: "expedition_likes", idColumn: "expedition_id" },
} as const;

export default function LikeButton({
  type,
  id,
  initialCount,
  initiallyLiked,
  canLike,
}: {
  type: "photo" | "expedition";
  id: string;
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

    const { table, idColumn } = CONFIG[type];
    startTransition(async () => {
      if (liked) {
        await supabase
          .from(table)
          .delete()
          .eq(idColumn, id)
          .eq("user_id", user.id);
      } else {
        await supabase.from(table).insert({ [idColumn]: id, user_id: user.id });
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
      {liked ? (
        <HeartFilledIcon className="inline-block w-4 h-4 mr-1" />
      ) : (
        <HeartIcon className="inline-block w-4 h-4 mr-1" />
      )}
      {count}
    </button>
  );
}
