import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";
import { HeartIcon, ChatBubbleIcon } from "@radix-ui/react-icons";

type FeedPhoto = {
  id: string;
  title: string;
  storage_key: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  owner: { username: string | null; avatar_url: string | null } | null;
  sourceLabel: string;
  sourceHref: string;
};

export default async function MyFeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: userFollows }, { data: expeditionFollows }] =
    await Promise.all([
      supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id),
      supabase
        .from("expedition_follows")
        .select("expedition_id")
        .eq("user_id", user.id),
    ]);

  const followedUserIds = (userFollows ?? []).map((r) => r.following_id);
  const followedExpeditionIds = (expeditionFollows ?? []).map(
    (r) => r.expedition_id,
  );

  const feedMap = new Map<string, FeedPhoto>();

  if (followedUserIds.length > 0) {
    const { data: userPhotos } = await supabase
      .from("photos")
      .select(
        "id, title, storage_key, like_count, comment_count, created_at, owner:profiles!photos_owner_id_fkey(username, avatar_url)",
      )
      .in("owner_id", followedUserIds)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    for (const p of userPhotos ?? []) {
      const owner = p.owner as unknown as {
        username: string | null;
        avatar_url: string | null;
      } | null;
      feedMap.set(p.id, {
        id: p.id,
        title: p.title,
        storage_key: p.storage_key,
        like_count: p.like_count,
        comment_count: p.comment_count,
        created_at: p.created_at,
        owner,
        sourceLabel: `@${owner?.username ?? "unknown"}`,
        sourceHref: `/profile/${owner?.username}`,
      });
    }
  }

  if (followedExpeditionIds.length > 0) {
    const { data: steps } = await supabase
      .from("expedition_steps")
      .select(
        "id, expedition_id, expedition:expeditions!expedition_steps_expedition_id_fkey(id, title)",
      )
      .in("expedition_id", followedExpeditionIds);

    const stepIds = (steps ?? []).map((s) => s.id);

    if (stepIds.length > 0) {
      const stepExpeditionMap = new Map<
        string,
        { id: string; title: string }
      >();
      for (const s of steps ?? []) {
        const exp = s.expedition as unknown as {
          id: string;
          title: string;
        } | null;
        if (exp) stepExpeditionMap.set(s.id, exp);
      }

      const { data: stepPhotos } = await supabase
        .from("expedition_step_photos")
        .select(
          `step_id, photo:photos!expedition_step_photos_photo_id_fkey(
            id, title, storage_key, like_count, comment_count, created_at,
            owner:profiles!photos_owner_id_fkey(username, avatar_url)
          )`,
        )
        .in("step_id", stepIds)
        .order("created_at", { ascending: false })
        .limit(100);

      for (const sp of stepPhotos ?? []) {
        const photo = sp.photo as unknown as {
          id: string;
          title: string;
          storage_key: string;
          like_count: number;
          comment_count: number;
          created_at: string;
          owner: { username: string | null; avatar_url: string | null } | null;
        } | null;
        if (!photo || feedMap.has(photo.id)) continue;
        const exp = stepExpeditionMap.get(sp.step_id);
        feedMap.set(photo.id, {
          id: photo.id,
          title: photo.title,
          storage_key: photo.storage_key,
          like_count: photo.like_count,
          comment_count: photo.comment_count,
          created_at: photo.created_at,
          owner: photo.owner,
          sourceLabel: exp?.title ?? "Expedition",
          sourceHref: exp ? `/expeditions/${exp.id}` : "/expeditions",
        });
      }
    }
  }

  const feed = Array.from(feedMap.values()).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="mx-auto max-w-5xl py-8">
      <h1 className="mb-6 text-2xl font-semibold">My Feed</h1>

      {feed.length === 0 && (
        <p className="text-gray-600">
          Nothing here yet. Follow some{" "}
          <Link href="/expeditions" className="underline">
            expeditions
          </Link>{" "}
          or{" "}
          <Link href="/" className="underline">
            users
          </Link>{" "}
          to see their photos here.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {feed.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-lg border">
            {/* Stretched link covers the card; source label sits above it via z-10 */}
            <Link
              href={`/photos/${p.id}`}
              className="absolute inset-0 z-0"
              aria-label={p.title}
            />
            <div className="relative aspect-square bg-gray-100">
              <Image
                src={publicUrl(p.storage_key)}
                alt={p.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition group-hover:scale-[1.02]"
              />
            </div>
            <div className="p-3">
              <p className="truncate font-medium">{p.title}</p>
              <div className="relative z-10 mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                {p.owner?.avatar_url ? (
                  <img
                    src={p.owner.avatar_url}
                    alt={p.owner.username ?? ""}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
                    {(p.owner?.username ?? "?")[0].toUpperCase()}
                  </span>
                )}
                <span className="truncate">
                  via{" "}
                  <Link href={p.sourceHref} className="hover:underline">
                    {p.sourceLabel}
                  </Link>
                </span>
                <span className="ml-auto flex items-center gap-1 shrink-0">
                  {p.like_count} <HeartIcon /> · {p.comment_count}{" "}
                  <ChatBubbleIcon />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
