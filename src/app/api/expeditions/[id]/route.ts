import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createExpeditionSchema } from "@/lib/schemas";
import { deleteObject } from "@/lib/r2";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = createExpeditionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  // Fetch current row to verify ownership and get the old cover key.
  const { data: existing } = await supabase
    .from("expeditions")
    .select("id, owner_id, cover_storage_key")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = {
    title: input.title,
    slug: input.slug,
    description: input.description ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.coverStorageKey !== undefined) {
    updates.cover_storage_key = input.coverStorageKey;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("expeditions")
    .update(updates)
    .eq("id", id)
    .select("slug")
    .single();

  if (updateErr || !updated) {
    const msg = updateErr?.message ?? "Update failed";
    const status = msg.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  // Replace steps: delete all existing, insert new set.
  await supabase.from("expedition_steps").delete().eq("expedition_id", id);

  if (input.steps.length > 0) {
    const { data: steps, error: stepsErr } = await supabase
      .from("expedition_steps")
      .insert(
        input.steps.map((step, i) => ({
          expedition_id: id,
          position: i,
          description: step.description,
          location_name: step.locationName ?? null,
        })),
      )
      .select("id");

    if (stepsErr) {
      console.error("Failed to insert expedition steps", stepsErr);
    } else if (steps) {
      await Promise.all(
        input.steps.map(async (step, i) => {
          if (step.lat != null && step.lng != null && steps[i]) {
            const { error } = await supabase.rpc("set_expedition_step_location", {
              p_step_id: steps[i].id,
              p_lng: step.lng,
              p_lat: step.lat,
            });
            if (error) console.error("set_expedition_step_location failed", error);
          }
        }),
      );
    }
  }

  // If the cover changed, clean up the old R2 object.
  if (
    input.coverStorageKey !== undefined &&
    existing.cover_storage_key &&
    existing.cover_storage_key !== input.coverStorageKey
  ) {
    await deleteObject(existing.cover_storage_key).catch(() => null);
  }

  return NextResponse.json({ slug: updated.slug });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase
    .from("expeditions")
    .select("id, owner_id, cover_storage_key")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: deleteErr } = await supabase.from("expeditions").delete().eq("id", id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  if (existing.cover_storage_key) {
    await deleteObject(existing.cover_storage_key).catch(() => null);
  }

  return new NextResponse(null, { status: 204 });
}
