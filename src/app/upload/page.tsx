import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UploadForm from "@/components/UploadForm";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: categories }, { data: licenses }] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("name"),
    supabase.from("licenses").select("code, name").order("code"),
  ]);

  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="mb-6 text-2xl font-semibold">Upload a photo</h1>
      <UploadForm categories={categories ?? []} licenses={licenses ?? []} />
    </div>
  );
}
