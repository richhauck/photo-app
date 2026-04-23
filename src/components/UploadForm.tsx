"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; slug: string };
type License = { code: string; name: string };

const VISIBILITY = [
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted (link only)" },
  { value: "private", label: "Private" },
] as const;

export default function UploadForm({
  categories,
  licenses,
}: {
  categories: Category[];
  licenses: License[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [licenseCode, setLicenseCode] = useState("ARR");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [locationName, setLocationName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Pick a photo");
    setBusy(true);

    try {
      // 1. Ask our API for a pre-signed R2 PUT URL.
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!urlRes.ok) throw new Error("Could not get upload URL");
      const { url, key } = (await urlRes.json()) as { url: string; key: string };

      // 2. Upload directly to R2.
      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("R2 upload failed");

      // 3. Create the DB row.
      const location =
        lat && lng
          ? { lat: Number(lat), lng: Number(lng), name: locationName || undefined }
          : undefined;

      const photoRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storageKey: key,
          mimeType: file.type,
          fileSizeBytes: file.size,
          title,
          description: description || undefined,
          licenseCode,
          visibility,
          categoryIds,
          galleryIds: [],
          location,
        }),
      });
      if (!photoRes.ok) throw new Error("Failed to save photo");
      const { id } = (await photoRes.json()) as { id: string };
      router.push(`/photos/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Photo</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          className="w-full rounded border px-3 py-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={5000}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Categories</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const active = categoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setCategoryIds((prev) =>
                    active ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                  )
                }
                className={`rounded-full border px-3 py-1 text-sm ${
                  active ? "bg-black text-white" : "bg-white"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">License</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={licenseCode}
          onChange={(e) => setLicenseCode(e.target.value)}
        >
          {licenses.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Visibility</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={visibility}
          onChange={(e) =>
            setVisibility(e.target.value as "public" | "unlisted" | "private")
          }
        >
          {VISIBILITY.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="rounded border p-3">
        <legend className="px-1 text-sm font-medium">OpenStreetMap pin (optional)</legend>
        <p className="mb-2 text-xs text-gray-600">
          Paste lat/lng or drop a pin on{" "}
          <a
            className="underline"
            href="https://www.openstreetmap.org/"
            target="_blank"
            rel="noreferrer"
          >
            openstreetmap.org
          </a>{" "}
          and copy the coordinates. A MapLibre picker is a good next step here.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="Latitude"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Longitude"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
        </div>
        <input
          className="mt-2 w-full rounded border px-3 py-2"
          placeholder="Location name (e.g. Central Park, NY)"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
        />
      </fieldset>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-black py-2 text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload photo"}
      </button>
    </form>
  );
}
