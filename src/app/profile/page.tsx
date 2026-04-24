import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditForm from "@/components/ProfileEditForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?message=Log+in+to+view+your+profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, bio")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl py-16">
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? profile?.username ?? "Avatar"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-4xl font-semibold text-gray-500">
                {(profile?.display_name || profile?.username || "?")[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>

          <div className="text-center sm:text-left">
            <p className="text-sm uppercase tracking-[0.18em] text-gray-500">Profile</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">
              {profile?.display_name || profile?.username || "Your profile"}
            </h1>
            {profile?.username && (
              <p className="text-sm text-gray-600">@{profile.username}</p>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-gray-100 bg-gray-50 p-6">
          <h2 className="text-lg font-semibold text-gray-900">About</h2>
          <p className="mt-3 min-h-[4rem] whitespace-pre-wrap text-gray-700">
            {profile?.bio?.trim() ? profile.bio : "No bio yet."}
          </p>
        </div>

        <ProfileEditForm
          initialBio={profile?.bio ?? ""}
          initialAvatarUrl={profile?.avatar_url ?? null}
          displayName={profile?.display_name ?? null}
          username={profile?.username ?? null}
        />
      </div>
    </div>
  );
}
