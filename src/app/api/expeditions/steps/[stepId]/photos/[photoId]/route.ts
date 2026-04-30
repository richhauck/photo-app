import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ stepId: string; photoId: string }> },
) {
  const { stepId, photoId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("expedition_step_photos")
    .delete()
    .eq("step_id", stepId)
    .eq("photo_id", photoId)
    .eq("contributor_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
