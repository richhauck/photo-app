import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { publicUrl } from "@/lib/r2";
import SearchInput from "@/components/SearchInput";
import Pagination from "@/components/Pagination";
import { HeartIcon, ChatBubbleIcon } from "@radix-ui/react-icons";

const PAGE_SIZE = 24;

export default async function HomeFeed({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // RLS already filters to public + unlisted + own.
  // For the home feed we only want public.
  let query = supabase
    .from("photos")
    .select(
      "id, title, storage_key, like_count, comment_count, created_at, owner:profiles!photos_owner_id_fkey(username, display_name, avatar_url)",
      { count: "exact" },
    )
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (q.trim()) {
    query = query.or(
      `title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`,
    );
  }

  const { data: photos, count, error } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  if (error) {
    return (
      <p className="p-8 text-red-600">Failed to load feed: {error.message}</p>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Recent photos</h1>
        <Suspense>
          <SearchInput placeholder="Search photos…" />
        </Suspense>
      </div>

      {photos && photos.length === 0 && (
        <p className="text-gray-600">
          {q.trim() ? (
            <>No photos match &ldquo;{q}&rdquo;.</>
          ) : (
            <>
              No photos yet.{" "}
              <Link className="underline" href="/upload">
                Upload the first one.
              </Link>
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {photos?.map((p) => {
          const owner = p.owner as unknown as {
            username: string | null;
            avatar_url: string | null;
          } | null;
          return (
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
                <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
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
                  @{owner?.username ?? "unknown"} · {p.like_count} <HeartIcon />{" "}
                  · {p.comment_count} <ChatBubbleIcon />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} pathname="/" q={q} />

      {count !== null && count > 0 && (
        <p className="mt-4 text-center text-xs text-gray-400">
          {count} photo{count !== 1 ? "s" : ""}
          {q.trim() ? ` matching "${q}"` : ""}
        </p>
      )}
    </div>
  );
}
