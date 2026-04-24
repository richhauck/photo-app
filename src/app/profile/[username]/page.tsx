import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio")
    .eq("username", username)
    .maybeSingle();

  if (!profile) notFound();

  const { data: photos } = await supabase
    .from("photos")
    .select("id, title, storage_key, width, height")
    .eq("owner_id", profile.id)
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(48);

  return (
    <div className="mx-auto max-w-3xl py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? profile.username ?? "Avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-4xl font-semibold text-gray-500">
                {(profile.display_name || profile.username || "?")[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>

          <div className="text-center sm:text-left">
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">
              {profile.display_name || profile.username}
            </h1>
            {profile.username && (
              <p className="text-sm text-gray-600">@{profile.username}</p>
            )}
            {profile.bio?.trim() && (
              <p className="mt-3 whitespace-pre-wrap text-gray-700">{profile.bio}</p>
            )}
          </div>
        </div>
      </div>

      {photos && photos.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <Link key={p.id} href={`/photos/${p.id}`} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <Image
                    src={publicUrl(p.storage_key)}
                    alt={p.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover transition-opacity group-hover:opacity-90"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
