import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";
import LikeButton from "@/components/LikeButton";
import CommentsSection from "@/components/CommentsSection";
import PhotoMap from "@/components/PhotoMap";
import DeletePhotoButton from "@/components/DeletePhotoButton";

// PostgREST returns geography columns as hex-encoded EWKB.
// Parse a Point to get lat/lng without an extra round-trip.
function parseWkbPoint(hex: string | null | undefined): { lat: number; lng: number } | null {
  if (!hex) return null;
  try {
    const buf = Buffer.from(hex, "hex");
    const view = new DataView(buf.buffer, buf.byteOffset);
    const le = view.getUint8(0) === 1;
    const type = view.getUint32(1, le);
    const hasSrid = !!(type & 0x20000000);
    const offset = 5 + (hasSrid ? 4 : 0);
    const lng = view.getFloat64(offset, le);
    const lat = view.getFloat64(offset + 8, le);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

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
       created_at, location,
       owner:profiles!photos_owner_id_fkey(id, username, display_name, avatar_url)`,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!photo) notFound();

  const coords = parseWkbPoint(photo.location as string | null);

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

  const { data: expeditionLinks } = await supabase
    .from("expedition_step_photos")
    .select(
      `step:expedition_steps!expedition_step_photos_step_id_fkey(
         id, position,
         expedition:expeditions!expedition_steps_expedition_id_fkey(id, title)
       )`,
    )
    .eq("photo_id", id);

  type ExpeditionLink = {
    step: { id: string; position: number; expedition: { id: string; title: string } };
  };
  const links = (expeditionLinks as unknown as ExpeditionLink[]) ?? [];

  const owner = photo.owner as unknown as {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;

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
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            {owner?.avatar_url ? (
              <img
                src={owner.avatar_url}
                alt={owner.username ?? ""}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                {(owner?.username ?? "?")[0].toUpperCase()}
              </span>
            )}
            <span>
              by{" "}
              <Link
                href={`/profile/${owner?.username}`}
                className="hover:underline"
              >
                @{owner?.username}
              </Link>{" "}
              · {new Date(photo.created_at).toLocaleDateString()}
              {photo.location_name ? ` · ${photo.location_name}` : ""}
            </span>
          </div>
        </div>
        <LikeButton
          photoId={photo.id}
          initialCount={photo.like_count}
          initiallyLiked={!!myLike}
          canLike={!!user}
        />
      </div>

      {photo.description && (
        <p className="mt-4 whitespace-pre-wrap text-gray-800">
          {photo.description}
        </p>
      )}

      <p className="mt-4 text-xs text-gray-500">
        License: {photo.license_code ?? "—"} · Visibility: {photo.visibility}
      </p>

      {user?.id === owner?.id && (
        <div className="mt-4 flex justify-end">
          <DeletePhotoButton photoId={photo.id} />
        </div>
      )}
      {coords && (
        <div className="mt-6">
          <PhotoMap
            lat={coords.lat}
            lng={coords.lng}
            label={photo.location_name}
          />
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-gray-700">Part of</h2>
          <ul className="space-y-1">
            {links.map(({ step }) => (
              <li key={step.id}>
                <Link
                  href={`/expeditions/${step.expedition.id}/steps/${step.id}`}
                  className="text-sm hover:underline"
                >
                  {step.expedition.title}
                  <span className="text-gray-400"> · Step {step.position}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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
