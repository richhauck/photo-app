import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUploadUrl, publicUrl } from "@/lib/r2";
import { avatarUrlSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = avatarUrlSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ext = parsed.data.filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const key = `users/${user.id}/avatar/${crypto.randomUUID()}.${ext}`;

  const url = await createUploadUrl({
    key,
    contentType: parsed.data.contentType,
    expiresInSeconds: 60,
  });

  return NextResponse.json({ url, key, publicUrl: publicUrl(key) });
}
