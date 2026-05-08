import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Photo App",
  description: "A photo sharing app",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .eq("username", user?.user_metadata.username)
    .maybeSingle();

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              📷 Photo App
            </Link>
            <Link href="/expeditions" className="text-sm underline">
              Expeditions
            </Link>
            <div className="flex items-center gap-4 text-sm">
              {user ? (
                <>
                  <Link href="/profile" className="inline-block">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-semibold text-gray-700">
                      {profile ? (
                        <img
                          src={profile.avatar_url}
                          alt={
                            profile.display_name ?? profile.username ?? "Avatar"
                          }
                          className="h-full w-full object-cover rounded-full"
                        />
                      ) : (
                        "?"
                      )}
                    </div>
                  </Link>
                  <Link
                    href="/upload"
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Upload
                  </Link>
                  <form action="/auth/logout" method="post">
                    <button
                      type="submit"
                      className="px-3 py-1 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 transition"
                    >
                      Log out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 py-1 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 transition"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup"
                    className="px-3 py-1 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 transition"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="px-4">
          {children}
          <footer className="mx-auto mt-12 max-w-5xl border-t py-4 text-right text-sm text-gray-500">
            <Link href="/about" className="underline">
              About
            </Link>
            <Link href="/terms" className="underline">
              Terms of Use
            </Link>
          </footer>
        </main>
      </body>
    </html>
  );
}
