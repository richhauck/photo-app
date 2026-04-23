import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPhotoSchema } from "@/lib/schemas";

/**
 * POST /api/photos
 * Called by the client AFTER it successfully uploads the file to R2.
 * Inserts the photo row plus category/gallery joins.
 *
 * The PostGIS `location` column is populated via raw SQL since the JS client
 * can't emit a geography literal directly. We go through an RPC wrapper for
 * the geo insert so RLS still enforces owner_id = auth.uid().
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = createPhotoSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Insert the base photo row. Location is set in a follow-up UPDATE so we can
  // use ST_SetSRID(ST_MakePoint(...), 4326)::geography without an RPC.
  const { data: photo, error: insertErr } = await supabase
    .from("photos")
    .insert({
      owner_id: user.id,
      title: input.title,
      description: input.description ?? null,
      license_code: input.licenseCode ?? null,
      visibility: input.visibility,
      storage_key: input.storageKey,
      mime_type: input.mimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      file_size_bytes: input.fileSizeBytes,
      taken_at: input.takenAt ?? null,
      camera_make: input.cameraMake ?? null,
      camera_model: input.cameraModel ?? null,
      location_name: input.location?.name ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !photo) {
    return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 });
  }

  // Set the location via RPC (defined in a follow-up migration — see README).
  if (input.location) {
    const { error: geoErr } = await supabase.rpc("set_photo_location", {
      p_photo_id: photo.id,
      p_lng: input.location.lng,
      p_lat: input.location.lat,
    });
    if (geoErr) console.error("set_photo_location failed", geoErr);
  }

  // Category joins
  if (input.categoryIds.length) {
    await supabase.from("photo_categories").insert(
      input.categoryIds.map((category_id) => ({ photo_id: photo.id, category_id })),
    );
  }

  // Gallery joins
  if (input.galleryIds.length) {
    await supabase.from("gallery_photos").insert(
      input.galleryIds.map((gallery_id) => ({ photo_id: photo.id, gallery_id })),
    );
  }

  return NextResponse.json({ id: photo.id });
}
