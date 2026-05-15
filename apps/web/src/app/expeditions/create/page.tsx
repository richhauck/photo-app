import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateExpeditionForm from "@/components/CreateExpeditionForm";

export default async function CreateExpeditionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="mb-6 text-2xl font-semibold">Create an expedition</h1>
      <CreateExpeditionForm />
    </div>
  );
}
