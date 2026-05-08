"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type FollowType = "user" | "expedition";

const CONFIG = {
  user: {
    table: "user_follows",
    idColumn: "following_id",
    selfColumn: "follower_id",
  },
  expedition: {
    table: "expedition_follows",
    idColumn: "expedition_id",
    selfColumn: "user_id",
  },
} as const;

export default function FollowButton({
  type,
  id,
  initiallyFollowing,
  canFollow,
}: {
  type: FollowType;
  id: string;
  initiallyFollowing: boolean;
  canFollow: boolean;
}) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    if (!canFollow) {
      window.location.href = "/login";
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setFollowing((v) => !v);

    const { table, idColumn, selfColumn } = CONFIG[type];
    startTransition(async () => {
      if (following) {
        await supabase
          .from(table)
          .delete()
          .eq(idColumn, id)
          .eq(selfColumn, user.id);
      } else {
        await supabase
          .from(table)
          .insert({ [idColumn]: id, [selfColumn]: user.id });
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        following
          ? "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
          : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
