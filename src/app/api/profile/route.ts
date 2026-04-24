import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/schemas";

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = updateProfileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
  if (parsed.data.avatarUrl !== undefined) updates.avatar_url = parsed.data.avatarUrl;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
