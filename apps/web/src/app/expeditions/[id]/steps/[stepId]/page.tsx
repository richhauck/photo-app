import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhotoMap from "@/components/PhotoMap";
import StepPhotoGallery from "@/components/StepPhotoGallery";

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

export default async function StepDetailPage({
  params,
}: {
  params: Promise<{ id: string; stepId: string }>;
}) {
  const { id, stepId } = await params;
  const supabase = await createClient();

  const { data: expedition } = await supabase
    .from("expeditions")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();

  if (!expedition) notFound();

  const { data: step } = await supabase
    .from("expedition_steps")
    .select("id, position, description, location_name, location")
    .eq("id", stepId)
    .eq("expedition_id", expedition.id)
    .maybeSingle();

  if (!step) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const coords = parseWkbPoint(step.location as string | null);

  return (
    <div className="mx-auto max-w-3xl py-8">
      <Link
        href={`/expeditions/${expedition.id}`}
        className="text-sm text-gray-500 hover:underline"
      >
        ← {expedition.title}
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Step {step.position}</h1>

      {step.description && (
        <p className="mt-2 whitespace-pre-wrap text-gray-800">{step.description}</p>
      )}

      {step.location_name && (
        <p className="mt-1 text-sm text-gray-500">📍 {step.location_name}</p>
      )}

      {coords && (
        <div className="mt-3">
          <PhotoMap lat={coords.lat} lng={coords.lng} label={step.location_name} />
        </div>
      )}

      <hr className="my-6" />

      <h2 className="mb-2 text-lg font-semibold">Photos</h2>

      {!user && (
        <p className="mb-4 text-sm text-gray-600">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to contribute your photos to this step.
        </p>
      )}

      <StepPhotoGallery
        stepId={step.id}
        stepIndex={step.position - 1}
        expeditionTitle={expedition.title}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
