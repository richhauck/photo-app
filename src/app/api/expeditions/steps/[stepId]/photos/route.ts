import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> },
) {
  const { stepId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const photoId = typeof body.photoId === "string" ? body.photoId : null;
  if (!photoId) return NextResponse.json({ error: "photoId required" }, { status: 400 });

  // Verify the photo is owned by this user and is public/unlisted.
  const { data: photo } = await supabase
    .from("photos")
    .select("id")
    .eq("id", photoId)
    .eq("owner_id", user.id)
    .is("deleted_at", null)
    .in("visibility", ["public", "unlisted"])
    .maybeSingle();
  if (!photo) {
    return NextResponse.json(
      { error: "Photo not found or not eligible (must be public or unlisted)" },
      { status: 404 },
    );
  }

  // Verify the step exists.
  const { data: step } = await supabase
    .from("expedition_steps")
    .select("id")
    .eq("id", stepId)
    .maybeSingle();
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  const { error } = await supabase
    .from("expedition_step_photos")
    .insert({ step_id: stepId, photo_id: photoId, contributor_id: user.id });

  if (error) {
    const status = error.message.includes("unique") ? 409 : 500;
    const msg = error.message.includes("unique")
      ? "Photo already added to this step"
      : error.message;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ ok: true });
}
