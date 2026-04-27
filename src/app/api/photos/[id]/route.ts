import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteObject } from "@/lib/r2";

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

  // RPC soft-deletes the row and returns storage_key in one trip.
  // Using a function avoids PostgREST's implicit RETURNING on UPDATE, which
  // would be re-checked against the SELECT policy and fail once deleted_at
  // is no longer NULL.
  const { data: storageKey, error } = await supabase.rpc("delete_photo", {
    p_photo_id: id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!storageKey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort R2 removal — don't fail the request if the object is already gone.
  await deleteObject(storageKey).catch(() => null);

  return new NextResponse(null, { status: 204 });
}
