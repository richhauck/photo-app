import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditExpeditionForm, { type InitialStep } from "@/components/EditExpeditionForm";

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

export default async function EditExpeditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: expedition } = await supabase
    .from("expeditions")
    .select("id, owner_id, slug, title, description, cover_storage_key, badge_storage_key")
    .eq("slug", slug)
    .maybeSingle();

  if (!expedition) notFound();
  if (expedition.owner_id !== user.id) notFound();

  const { data: steps } = await supabase
    .from("expedition_steps")
    .select("description, location_name, location")
    .eq("expedition_id", expedition.id)
    .order("position", { ascending: true });

  const initialSteps: InitialStep[] = (steps ?? []).map((s) => {
    const coords = parseWkbPoint(s.location as string | null);
    return {
      description: s.description,
      locationName: s.location_name ?? "",
      lat: coords ? String(coords.lat) : "",
      lng: coords ? String(coords.lng) : "",
    };
  });

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="mb-6 text-2xl font-semibold">Edit expedition</h1>
      <EditExpeditionForm
        expeditionId={expedition.id}
        initialTitle={expedition.title}
        initialSlug={expedition.slug}
        initialDescription={expedition.description ?? ""}
        initialCoverStorageKey={expedition.cover_storage_key ?? null}
        initialBadgeStorageKey={expedition.badge_storage_key ?? null}
        initialSteps={initialSteps}
      />
    </div>
  );
}
