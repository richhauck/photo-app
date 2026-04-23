import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";
import LikeButton from "@/components/LikeButton";
import CommentsSection from "@/components/CommentsSection";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("photos")
    .select(
      `id, title, description, storage_key, width, height,
       license_code, visibility, location_name, like_count, comment_count,
       created_at,
       owner:profiles!photos_owner_id_fkey(id, username, display_name, avatar_url)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!photo) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myLike } = user
    ? await supabase
        .from("likes")
        .select("photo_id")
        .eq("photo_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-100">
        <Image
          src={publicUrl(photo.storage_key)}
          alt={photo.title}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-contain"
          priority
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{photo.title}</h1>
          <p className="text-sm text-gray-600">
            by @
            {/* @ts-expect-error — Supabase typed joins need generated types */}
            {photo.owner?.username}{" "}
            · {new Date(photo.created_at).toLocaleDateString()}
            {photo.location_name ? ` · ${photo.location_name}` : ""}
          </p>
        </div>
        <LikeButton
          photoId={photo.id}
          initialCount={photo.like_count}
          initiallyLiked={!!myLike}
          canLike={!!user}
        />
      </div>

      {photo.description && (
        <p className="mt-4 whitespace-pre-wrap text-gray-800">{photo.description}</p>
      )}

      <p className="mt-4 text-xs text-gray-500">
        License: {photo.license_code ?? "—"} · Visibility: {photo.visibility}
      </p>

      <hr className="my-8" />

      <h2 className="mb-4 text-lg font-semibold">
        Comments ({photo.comment_count})
      </h2>

      {!user && (
        <p className="mb-4 text-sm text-gray-600">
          <Link className="underline" href="/login">
            Log in
          </Link>{" "}
          to comment.
        </p>
      )}

      <CommentsSection photoId={photo.id} canPost={!!user} />
    </div>
  );
}
