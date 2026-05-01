import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createExpeditionSchema } from "@/lib/schemas";

export async function POST(req: Request) {
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

  const { data: expedition, error: insertErr } = await supabase
    .from("expeditions")
    .insert({
      owner_id: user.id,
      title: input.title,
      description: input.description ?? null,
      cover_storage_key: input.coverStorageKey ?? null,
      badge_storage_key: input.badgeStorageKey ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !expedition) {
    const msg = insertErr?.message ?? "Insert failed";
    const status = msg.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  if (input.steps.length > 0) {
    const { data: steps, error: stepsErr } = await supabase
      .from("expedition_steps")
      .insert(
        input.steps.map((step, i) => ({
          expedition_id: expedition.id,
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

  return NextResponse.json({ id: expedition.id });
}
