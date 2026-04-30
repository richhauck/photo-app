"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };
    img.src = objectUrl;
  });
}

function canvasToAvifFile(
  canvas: HTMLCanvasElement,
  name: string,
  quality = 0.7,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("AVIF conversion failed"));
        resolve(new File([blob], name, { type: "image/avif" }));
      },
      "image/avif",
      quality,
    );
  });
}

async function resizeToAvif(
  file: File,
  maxW: number,
  maxH: number,
  quality = 0.7,
): Promise<File> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return canvasToAvifFile(
    canvas,
    file.name.replace(/\.[^.]+$/, ".avif"),
    quality,
  );
}

async function thumbnailToAvif(
  file: File,
  size: number,
  quality = 0.8,
): Promise<{ file: File; width: number; height: number }> {
  const img = await loadImage(file);
  const { naturalWidth: w, naturalHeight: h } = img;
  const squareSize = Math.min(w, h);
  const sx = (w - squareSize) / 2;
  const sy = (h - squareSize) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(img, sx, sy, squareSize, squareSize, 0, 0, size, size);
  return {
    file: await canvasToAvifFile(canvas, "thumbnail.avif", quality),
    width: size,
    height: size,
  };
}
import LocationPicker from "@/components/LocationPicker";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [licenseCode, setLicenseCode] = useState(licenses[0]?.code ?? "");
  const [visibility, setVisibility] = useState<
    "public" | "unlisted" | "private"
  >("public");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [locationName, setLocationName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Pick a photo");
    setBusy(true);

    try {
      // 1. Process original (max 1080×1440) and 350×350 thumbnail in parallel.
      const [avif, thumb] = await Promise.all([
        resizeToAvif(file, 1080, 1440),
        thumbnailToAvif(file, 350),
      ]);

      // 2. Get pre-signed URLs for both in one request (same photoId in the keys).
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: avif.name,
          contentType: avif.type,
          sizeBytes: avif.size,
          includeThumbnail: true,
          thumbnailSizeBytes: thumb.file.size,
        }),
      });
      if (!urlRes.ok) throw new Error("Could not get upload URL");
      const { url, key, thumbnailUrl, thumbnailKey } =
        (await urlRes.json()) as {
          url: string;
          key: string;
          thumbnailUrl: string;
          thumbnailKey: string;
        };

      // 3. Upload both to R2 in parallel.
      await Promise.all([
        fetch(url, {
          method: "PUT",
          headers: { "Content-Type": avif.type },
          body: avif,
        }).then((r) => {
          if (!r.ok) throw new Error("R2 upload failed");
        }),
        fetch(thumbnailUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/avif" },
          body: thumb.file,
        }).then((r) => {
          if (!r.ok) throw new Error("R2 thumbnail upload failed");
        }),
      ]);

      // 4. Create the DB row.
      const location =
        lat && lng
          ? {
              lat: Number(lat),
              lng: Number(lng),
              name: locationName || undefined,
            }
          : undefined;

      const photoRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storageKey: key,
          mimeType: avif.type,
          fileSizeBytes: avif.size,
          title,
          description: description || undefined,
          licenseCode,
          visibility,
          categoryIds,
          galleryIds: [],
          location,
          thumbnail: {
            storageKey: thumbnailKey,
            width: thumb.width,
            height: thumb.height,
            fileSizeBytes: thumb.file.size,
          },
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
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files[0];
            if (dropped) setFile(dropped);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed px-4 py-8 text-sm transition-colors ${
            isDragging
              ? "border-black bg-gray-100 text-black"
              : "border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400"
          }`}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="max-h-72 w-full rounded object-contain"
            />
          ) : (
            <>
              <svg className="mb-2 h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span>Drag &amp; drop a photo here, or click to browse</span>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
          required
        />
        {previewUrl && (
          <button
            type="button"
            onClick={() => setFile(null)}
            className="mt-1 text-xs text-red-600 underline"
          >
            Remove photo
          </button>
        )}
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

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Visibility</legend>
        <div className="space-y-1">
          {VISIBILITY.map((v) => (
            <label
              key={v.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="visibility"
                value={v.value}
                checked={visibility === v.value}
                onChange={() => setVisibility(v.value)}
              />
              {v.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded border p-3">
        <legend className="px-1 text-sm font-medium">
          Location (optional)
        </legend>
        <p className="mb-2 text-xs text-gray-600">
          Click the map to drop a pin.
        </p>
        <LocationPicker
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
        />
        {lat && lng && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {lat}, {lng}
            </span>
            <button
              type="button"
              onClick={() => {
                setLat("");
                setLng("");
              }}
              className="text-xs text-red-600 underline"
            >
              Clear pin
            </button>
          </div>
        )}
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
