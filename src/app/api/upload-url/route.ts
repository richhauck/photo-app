import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createUploadUrl } from "@/lib/r2";
import { uploadUrlSchema } from "@/lib/schemas";

/**
 * POST /api/upload-url
 * Body: { filename, contentType, sizeBytes }
 * Returns: { url, key } — a pre-signed PUT URL and the R2 object key to use.
 * The client then does: fetch(url, { method: "PUT", body: file, headers: { "Content-Type": contentType } })
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = uploadUrlSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const ext = parsed.data.filename.split(".").pop()?.toLowerCase() ?? "bin";
  const photoId = crypto.randomUUID();
  const key = `users/${user.id}/photos/${photoId}/original.${ext}`;

  const url = await createUploadUrl({
    key,
    contentType: parsed.data.contentType,
    maxBytes: parsed.data.sizeBytes,
    expiresInSeconds: 60,
  });

  return NextResponse.json({ url, key });
}
