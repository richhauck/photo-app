import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";

export default async function HomeFeed() {
  const supabase = await createClient();

  // RLS already filters to public + unlisted + own.
  // For the home feed we only want public.
  const { data: photos, error } = await supabase
    .from("photos")
    .select(
      "id, title, storage_key, like_count, comment_count, created_at, owner:profiles!photos_owner_id_fkey(username, display_name)",
    )
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    return <p className="p-8 text-red-600">Failed to load feed: {error.message}</p>;
  }

  return (
    <div className="mx-auto max-w-5xl py-8">
      <h1 className="mb-6 text-2xl font-semibold">Recent photos</h1>

      {photos && photos.length === 0 && (
        <p className="text-gray-600">
          No photos yet.{" "}
          <Link className="underline" href="/upload">
            Upload the first one.
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {photos?.map((p) => (
          <Link
            key={p.id}
            href={`/photos/${p.id}`}
            className="group block overflow-hidden rounded-lg border"
          >
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
              <p className="text-xs text-gray-500">
                by @
                {/* @ts-expect-error — Supabase typed joins need generated types */}
                {p.owner?.username ?? "unknown"} · {p.like_count} ♥ ·{" "}
                {p.comment_count} 💬
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
