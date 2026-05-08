import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";
import SearchInput from "@/components/SearchInput";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 24;

export default async function ExpeditionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("expeditions")
    .select(
      `id, title, description, cover_storage_key, badge_storage_key, like_count, comment_count, created_at,
       owner:profiles!expeditions_owner_id_fkey(username, display_name, avatar_url)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q.trim()) {
    query = query.or(
      `title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`,
    );
  }

  const { data: expeditions, count, error } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  if (error) {
    return (
      <p className="p-8 text-red-600">
        Failed to load expeditions: {error.message}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Expeditions</h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <SearchInput placeholder="Search expeditions…" />
          </Suspense>
          <Link
            href="/expeditions/create"
            className="shrink-0 rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Create expedition
          </Link>
        </div>
      </div>

      {expeditions && expeditions.length === 0 && (
        <p className="text-gray-600">
          {q.trim() ? (
            <>No expeditions match &ldquo;{q}&rdquo;.</>
          ) : (
            <>
              No expeditions yet.{" "}
              <Link className="underline" href="/expeditions/create">
                Create the first one.
              </Link>
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
        {expeditions?.map((exp) => {
          const owner = exp.owner as unknown as { username: string | null; avatar_url: string | null } | null;
          return (
            <Link
              key={exp.id}
              href={`/expeditions/${exp.id}`}
              className="group block overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-md"
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
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                    {exp.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                  {owner?.avatar_url ? (
                    <img
                      src={owner.avatar_url}
                      alt={owner.username ?? ""}
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
                      {(owner?.username ?? "?")[0].toUpperCase()}
                    </span>
                  )}
                  @{owner?.username ?? "unknown"} · {exp.like_count} ♥ ·{" "}
                  {exp.comment_count} 💬
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        pathname="/expeditions"
        q={q}
      />

      {count !== null && count > 0 && (
        <p className="mt-4 text-center text-xs text-gray-400">
          {count} expedition{count !== 1 ? "s" : ""}
          {q.trim() ? ` matching "${q}"` : ""}
        </p>
      )}
    </div>
  );
}
