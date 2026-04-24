"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialBio: string;
  initialAvatarUrl: string | null;
  displayName: string | null;
  username: string | null;
};

export default function ProfileEditForm({
  initialBio,
  initialAvatarUrl,
  displayName,
  username,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bio, setBio] = useState(initialBio);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);

    try {
      let avatarUrl: string | undefined;

      if (avatarFile) {
        const urlRes = await fetch("/api/avatar-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: avatarFile.name,
            contentType: avatarFile.type,
            sizeBytes: avatarFile.size,
          }),
        });
        if (!urlRes.ok) throw new Error("Could not get avatar upload URL");
        const { url, publicUrl } = (await urlRes.json()) as {
          url: string;
          publicUrl: string;
          key: string;
        };

        const putRes = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": avatarFile.type },
          body: avatarFile,
        });
        if (!putRes.ok) throw new Error("Avatar upload failed");
        avatarUrl = publicUrl;
      }

      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bio, ...(avatarUrl ? { avatarUrl } : {}) }),
      });
      if (!patchRes.ok) {
        const { error: msg } = await patchRes.json();
        throw new Error(msg ?? "Failed to save profile");
      }

      setAvatarFile(null);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const initials =
    (displayName || username || "?")[0]?.toUpperCase() ?? "?";

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Edit profile</h2>

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      {saved && (
        <p className="rounded bg-green-50 p-3 text-sm text-green-700">
          Profile saved.
        </p>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Avatar
        </label>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-semibold text-gray-500">
                {initials}
              </span>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Choose image
            </button>
            {avatarFile && (
              <p className="mt-1 text-xs text-gray-500">{avatarFile.name}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="bio"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Bio
        </label>
        <textarea
          id="bio"
          className="w-full rounded border px-3 py-2 text-sm"
          rows={4}
          maxLength={1000}
          value={bio}
          onChange={(e) => {
            setBio(e.target.value);
            setSaved(false);
          }}
          placeholder="Tell people a little about yourself…"
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {bio.length}/1000
        </p>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
