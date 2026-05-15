import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Filter by both id and author_id so the delete is a no-op for any comment
  // the user doesn't own — no separate ownership fetch needed.
  const { count, error } = await supabase
    .from("comments")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("author_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
