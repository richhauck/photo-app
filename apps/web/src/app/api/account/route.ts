import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObject, R2_PUBLIC_BASE_URL } from "@/lib/r2";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Gather all R2 storage keys before removing DB rows.
  const storageKeys: string[] = [];

  const { data: photos } = await admin
    .from("photos")
    .select("storage_key, photo_variants(storage_key)")
    .eq("user_id", user.id);

  for (const photo of photos ?? []) {
    if (photo.storage_key) storageKeys.push(photo.storage_key);
    for (const variant of (photo.photo_variants as { storage_key: string }[] | null) ?? []) {
      if (variant.storage_key) storageKeys.push(variant.storage_key);
    }
  }

  const { data: expeditions } = await admin
    .from("expeditions")
    .select("cover_storage_key, badge_storage_key")
    .eq("owner_id", user.id);

  for (const exp of expeditions ?? []) {
    if (exp.cover_storage_key) storageKeys.push(exp.cover_storage_key);
    if (exp.badge_storage_key) storageKeys.push(exp.badge_storage_key);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.avatar_url) {
    const base = R2_PUBLIC_BASE_URL.replace(/\/$/, "");
    if (base && profile.avatar_url.startsWith(`${base}/`)) {
      storageKeys.push(profile.avatar_url.slice(base.length + 1));
    }
  }

  // Delete user-generated content. FK cascades handle child rows
  // (photo_variants, likes, comments, expedition_steps, etc.).
  await admin.from("photos").delete().eq("user_id", user.id);
  await admin.from("expeditions").delete().eq("owner_id", user.id);
  // Remove any remaining interactions the user made on others' content.
  await admin.from("likes").delete().eq("user_id", user.id);
  await admin.from("comments").delete().eq("user_id", user.id);
  await admin.from("expedition_likes").delete().eq("user_id", user.id);
  await admin.from("expedition_comments").delete().eq("user_id", user.id);

  // Deleting from auth.users cascades to profiles.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  // Best-effort R2 cleanup — don't fail if an object is already gone.
  await Promise.all(storageKeys.map((key) => deleteObject(key).catch(() => null)));

  return new NextResponse(null, { status: 204 });
}
