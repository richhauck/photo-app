import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";

export default async function ExpeditionsPage() {
  const supabase = await createClient();

  const { data: expeditions, error } = await supabase
    .from("expeditions")
    .select(
      `id, slug, title, description, cover_storage_key, badge_storage_key, like_count, comment_count, created_at,
       owner:profiles!expeditions_owner_id_fkey(username, display_name, avatar_url)`,
    )
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) {
    return <p className="p-8 text-red-600">Failed to load expeditions: {error.message}</p>;
  }

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expeditions</h1>
        <Link
          href="/expeditions/create"
          className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          Create expedition
        </Link>
      </div>

      {expeditions && expeditions.length === 0 && (
        <p className="text-gray-600">
          No expeditions yet.{" "}
          <Link className="underline" href="/expeditions/create">
            Create the first one.
          </Link>
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {expeditions?.map((exp) => (
          <Link
            key={exp.id}
            href={`/expeditions/${exp.slug}`}
            className="group block overflow-hidden rounded-lg border bg-white hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-video bg-gray-100">
              {exp.cover_storage_key ? (
                <Image
                  src={publicUrl(exp.cover_storage_key)}
                  alt={exp.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl text-gray-300">
                  🗺️
                </div>
              )}
              {exp.badge_storage_key && (
                <img
                  src={publicUrl(exp.badge_storage_key)}
                  alt=""
                  className="absolute bottom-2 left-2 h-10 w-10 rounded-md border-2 border-white object-cover shadow"
                />
              )}
            </div>
            <div className="p-4">
              <p className="truncate font-semibold">{exp.title}</p>
              {exp.description && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{exp.description}</p>
              )}
              {/* @ts-expect-error — Supabase typed joins need generated types */}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                {/* @ts-expect-error — Supabase typed joins need generated types */}
                {exp.owner?.avatar_url ? (
                  <img
                    // @ts-expect-error — Supabase typed joins need generated types
                    src={exp.owner.avatar_url}
                    // @ts-expect-error — Supabase typed joins need generated types
                    alt={exp.owner.username ?? ""}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
                    {/* @ts-expect-error — Supabase typed joins need generated types */}
                    {(exp.owner?.username ?? "?")[0].toUpperCase()}
                  </span>
                )}
                {/* @ts-expect-error — Supabase typed joins need generated types */}
                @{exp.owner?.username ?? "unknown"} · {exp.like_count} ♥ · {exp.comment_count} 💬
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
