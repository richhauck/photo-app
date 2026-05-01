import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";
import ExpeditionLikeButton from "@/components/ExpeditionLikeButton";
import ExpeditionComments from "@/components/ExpeditionComments";
import DeleteExpeditionButton from "@/components/DeleteExpeditionButton";
import PhotoMap from "@/components/PhotoMap";

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

type Variant = { variant: string; storage_key: string };

type TeaserPhoto = {
  id: string;
  photo: { id: string; title: string; storage_key: string; photo_variants: Variant[] };
};

function thumbKey(storageKey: string, variants: Variant[]): string {
  return variants.find((v) => v.variant === "thumbnail")?.storage_key ?? storageKey;
}

export default async function ExpeditionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: expedition } = await supabase
    .from("expeditions")
    .select(
      `id, title, description, cover_storage_key, badge_storage_key, like_count, comment_count, created_at,
       owner:profiles!expeditions_owner_id_fkey(id, username, display_name, avatar_url)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!expedition) notFound();

  const { data: steps } = await supabase
    .from("expedition_steps")
    .select(
      `id, position, description, location_name, location,
       expedition_step_photos(
         id,
         photo:photos!expedition_step_photos_photo_id_fkey(
           id, title, storage_key,
           photo_variants(variant, storage_key)
         )
       )`,
    )
    .eq("expedition_id", expedition.id)
    .order("position", { ascending: true });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myLike } = user
    ? await supabase
        .from("expedition_likes")
        .select("expedition_id")
        .eq("expedition_id", expedition.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const owner = expedition.owner as unknown as {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;

  return (
    <div className="mx-auto max-w-3xl py-8">
      {expedition.cover_storage_key && (
        <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={publicUrl(expedition.cover_storage_key)}
            alt={expedition.title}
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {expedition.badge_storage_key && (
            <img
              src={publicUrl(expedition.badge_storage_key)}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl border object-cover shadow-sm"
            />
          )}
          <div>
            <h1 className="text-2xl font-semibold">{expedition.title}</h1>
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
                <Link href={`/profile/${owner?.username}`} className="hover:underline">
                  @{owner?.username}
                </Link>{" "}
                · {new Date(expedition.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <ExpeditionLikeButton
          expeditionId={expedition.id}
          initialCount={expedition.like_count}
          initiallyLiked={!!myLike}
          canLike={!!user}
        />
      </div>

      {user?.id === owner?.id && (
        <div className="mt-4 flex items-center justify-end gap-4">
          <Link
            href={`/expeditions/${expedition.id}/edit`}
            className="text-sm underline hover:text-gray-600"
          >
            Edit expedition
          </Link>
          <DeleteExpeditionButton expeditionId={expedition.id} />
        </div>
      )}

      {expedition.description && (
        <p className="mt-4 whitespace-pre-wrap text-gray-800">{expedition.description}</p>
      )}

      <div className="mt-6">
        {user ? (
          <a
            href="#steps"
            className="inline-block rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Join the expedition →
          </a>
        ) : (
          <Link
            href="/login"
            className="inline-block rounded-lg border px-5 py-2.5 text-sm font-medium hover:bg-gray-50"
          >
            Log in to join the expedition
          </Link>
        )}
      </div>

      {steps && steps.length > 0 && (
        <section id="steps" className="mt-10">
          <h2 className="mb-6 text-lg font-semibold">Steps</h2>
          <ol className="space-y-10">
            {steps.map((step, i) => {
              const coords = parseWkbPoint(step.location as string | null);
              const stepPhotos = (step.expedition_step_photos as unknown as TeaserPhoto[]) ?? [];
              const teaser = stepPhotos.slice(0, 5);
              const total = stepPhotos.length;

              return (
                <li key={step.id} className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-semibold text-white">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="whitespace-pre-wrap text-gray-800">{step.description}</p>
                    {step.location_name && (
                      <p className="mt-1 text-sm text-gray-500">📍 {step.location_name}</p>
                    )}
                    {coords && (
                      <div className="mt-3">
                        <PhotoMap
                          lat={coords.lat}
                          lng={coords.lng}
                          label={step.location_name}
                        />
                      </div>
                    )}

                    {/* Photo teaser strip */}
                    <div className="mt-4">
                      {teaser.length > 0 ? (
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1.5">
                            {teaser.map((sp) => (
                              <Link
                                key={sp.id}
                                href={`/expeditions/${expedition.id}/steps/${step.id}`}
                                className="block h-16 w-16 overflow-hidden rounded border bg-gray-100 transition hover:opacity-90"
                              >
                                <img
                                  src={publicUrl(
                                    thumbKey(sp.photo.storage_key, sp.photo.photo_variants ?? []),
                                  )}
                                  alt={sp.photo.title}
                                  className="h-full w-full object-cover"
                                />
                              </Link>
                            ))}
                          </div>
                          <Link
                            href={`/expeditions/${expedition.id}/steps/${step.id}`}
                            className="text-sm text-gray-500 hover:underline"
                          >
                            {total > 5 ? `View all (${total})` : "View all"} →
                          </Link>
                        </div>
                      ) : (
                        <Link
                          href={`/expeditions/${expedition.id}/steps/${step.id}`}
                          className="text-sm text-gray-500 hover:underline"
                        >
                          {user ? "Be the first to add a photo →" : "No photos yet →"}
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <hr className="my-8" />

      <h2 className="mb-4 text-lg font-semibold">
        Comments ({expedition.comment_count})
      </h2>

      {!user && (
        <p className="mb-4 text-sm text-gray-600">
          <Link className="underline" href="/login">
            Log in
          </Link>{" "}
          to comment.
        </p>
      )}

      <ExpeditionComments expeditionId={expedition.id} canPost={!!user} />
    </div>
  );
}
