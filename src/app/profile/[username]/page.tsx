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

  const [{ data: photos }, { data: userContributions }] = await Promise.all([
    supabase
      .from("photos")
      .select("id, title, storage_key, width, height")
      .eq("owner_id", profile.id)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(48),
    supabase
      .from("expedition_step_photos")
      .select("step_id, expedition_steps(expedition_id)")
      .eq("contributor_id", profile.id),
  ]);

  // Determine which expeditions this user has completed (contributed to every step).
  let completedExpeditions: Array<{
    id: string;
    slug: string;
    title: string;
    badge_storage_key: string | null;
  }> = [];

  if (userContributions && userContributions.length > 0) {
    // Map expedition_id → distinct step_ids the user contributed to.
    const contributedByExpedition = new Map<string, Set<string>>();
    for (const row of userContributions) {
      const step = row.expedition_steps as unknown as { expedition_id: string } | null;
      if (!step) continue;
      const expId = step.expedition_id;
      if (!contributedByExpedition.has(expId)) {
        contributedByExpedition.set(expId, new Set());
      }
      contributedByExpedition.get(expId)!.add(row.step_id);
    }

    const expeditionIds = Array.from(contributedByExpedition.keys());

    const { data: expeditionDetails } = await supabase
      .from("expeditions")
      .select("id, slug, title, badge_storage_key, expedition_steps(id)")
      .in("id", expeditionIds);

    if (expeditionDetails) {
      completedExpeditions = expeditionDetails
        .filter((exp) => {
          const steps = (exp.expedition_steps as { id: string }[]) ?? [];
          if (steps.length === 0) return false;
          return (contributedByExpedition.get(exp.id)?.size ?? 0) >= steps.length;
        })
        .map((exp) => ({
          id: exp.id,
          slug: exp.slug,
          title: exp.title,
          badge_storage_key: exp.badge_storage_key,
        }));
    }
  }

  const badgedExpeditions = completedExpeditions.filter((e) => e.badge_storage_key);

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

      {badgedExpeditions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Badges</h2>
          <div className="flex flex-wrap gap-4">
            {badgedExpeditions.map((e) => (
              <Link key={e.id} href={`/expeditions/${e.slug}`} title={e.title}>
                <img
                  src={publicUrl(e.badge_storage_key!)}
                  alt={e.title}
                  className="h-16 w-16 rounded-xl border object-cover shadow-sm transition hover:opacity-90"
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      {completedExpeditions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Completed Expeditions</h2>
          <ul className="space-y-2">
            {completedExpeditions.map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                  ✓
                </span>
                <Link
                  href={`/expeditions/${e.slug}`}
                  className="text-sm text-gray-800 hover:underline"
                >
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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
