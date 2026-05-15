"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { publicUrl } from "@/lib/r2";

// ─── Image helpers ────────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

async function toAvifBlob(
  canvas: HTMLCanvasElement,
  name: string,
  quality = 0.8,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(new File([blob], name, { type: "image/avif" }))
          : reject(new Error("AVIF conversion failed")),
      "image/avif",
      quality,
    );
  });
}

async function resizeToAvif(
  file: File,
  maxW: number,
  maxH: number,
): Promise<File> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return toAvifBlob(canvas, file.name.replace(/\.[^.]+$/, ".avif"));
}

async function thumbnailToAvif(
  file: File,
  size: number,
): Promise<{ file: File; width: number; height: number }> {
  const img = await loadImage(file);
  const { naturalWidth: w, naturalHeight: h } = img;
  const sq = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(img, (w - sq) / 2, (h - sq) / 2, sq, sq, 0, 0, size, size);
  return {
    file: await toAvifBlob(canvas, "thumbnail.avif"),
    width: size,
    height: size,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = { variant: string; storage_key: string };

type StepPhoto = {
  id: string;
  contributor_id: string;
  photo: {
    id: string;
    title: string;
    storage_key: string;
    photo_variants: Variant[];
  };
  contributor: { username: string | null; avatar_url: string | null } | null;
};

type UserPhoto = {
  id: string;
  title: string;
  storage_key: string;
  photo_variants: Variant[];
};

function thumb(storageKey: string, variants: Variant[]): string {
  return (
    variants.find((v) => v.variant === "thumbnail")?.storage_key ?? storageKey
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StepPhotoGallery({
  stepId,
  stepIndex,
  expeditionTitle,
  currentUserId,
}: {
  stepId: string;
  stepIndex: number;
  expeditionTitle: string;
  currentUserId: string | null;
}) {
  const [stepPhotos, setStepPhotos] = useState<StepPhoto[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<"existing" | "upload">("existing");
  const [userPhotos, setUserPhotos] = useState<UserPhoto[] | null>(null);
  const [addBusy, setAddBusy] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState(
    `Step ${stepIndex + 1} — ${expeditionTitle}`,
  );
  const [uploadBusy, setUploadBusy] = useState(false);

  const loadStepPhotos = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("expedition_step_photos")
      .select(
        `id, contributor_id,
         photo:photos!expedition_step_photos_photo_id_fkey(id, title, storage_key, photo_variants(variant, storage_key)),
         contributor:profiles!expedition_step_photos_contributor_id_fkey(username, avatar_url)`,
      )
      .eq("step_id", stepId)
      .order("created_at", { ascending: true });
    const photos = (data as unknown as StepPhoto[]) ?? [];
    setStepPhotos(photos);
    setAddedIds(new Set(photos.map((p) => p.photo?.id).filter(Boolean)));
  }, [stepId]);

  useEffect(() => {
    loadStepPhotos();
  }, [loadStepPhotos]);

  useEffect(() => {
    if (!uploadFile) {
      setUploadPreview(null);
      return;
    }
    const url = URL.createObjectURL(uploadFile);
    setUploadPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);

  async function loadUserPhotos() {
    if (userPhotos !== null) return;
    const supabase = createClient();
    console.log(supabase);

    const { data } = await supabase
      .from("photos")
      .select("id, title, storage_key, photo_variants(variant, storage_key)")
      .is("deleted_at", null)
      .in("visibility", ["public", "unlisted"])
      .order("created_at", { ascending: false })
      .limit(60);

    setUserPhotos((data as unknown as UserPhoto[]) ?? []);
  }

  function openAdd() {
    setShowAdd(true);
    setTab("existing");
    loadUserPhotos();
    setError(null);
  }

  async function addPhoto(photoId: string) {
    if (addBusy) return;
    setAddBusy(photoId);
    setError(null);
    const res = await fetch(`/api/expeditions/steps/${stepId}/photos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoId }),
    });
    if (res.ok) {
      await loadStepPhotos();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to add photo");
    }
    setAddBusy(null);
  }

  async function removePhoto(photoId: string) {
    setRemoveBusy(photoId);
    const res = await fetch(
      `/api/expeditions/steps/${stepId}/photos/${photoId}`,
      {
        method: "DELETE",
      },
    );
    if (res.ok) await loadStepPhotos();
    setRemoveBusy(null);
  }

  async function uploadAndAdd() {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploadBusy(true);
    setError(null);
    try {
      const [avif, thumbData] = await Promise.all([
        resizeToAvif(uploadFile, 1080, 1440),
        thumbnailToAvif(uploadFile, 350),
      ]);

      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filename: avif.name,
          contentType: avif.type,
          sizeBytes: avif.size,
          includeThumbnail: true,
          thumbnailSizeBytes: thumbData.file.size,
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

      await Promise.all([
        fetch(url, {
          method: "PUT",
          headers: { "Content-Type": avif.type },
          body: avif,
        }).then((r) => {
          if (!r.ok) throw new Error("Upload failed");
        }),
        fetch(thumbnailUrl, {
          method: "PUT",
          headers: { "Content-Type": "image/avif" },
          body: thumbData.file,
        }).then((r) => {
          if (!r.ok) throw new Error("Thumbnail upload failed");
        }),
      ]);

      const photoRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storageKey: key,
          mimeType: avif.type,
          fileSizeBytes: avif.size,
          title: uploadTitle.trim(),
          visibility: "public",
          categoryIds: [],
          galleryIds: [],
          thumbnail: {
            storageKey: thumbnailKey,
            width: thumbData.width,
            height: thumbData.height,
            fileSizeBytes: thumbData.file.size,
          },
        }),
      });
      if (!photoRes.ok) throw new Error("Failed to save photo");
      const { id: photoId } = (await photoRes.json()) as { id: string };

      await addPhoto(photoId);
      setUploadFile(null);
      setShowAdd(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Gallery grid */}
      {stepPhotos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {stepPhotos.map((sp) => (
            <div
              key={sp.id}
              className="group relative aspect-square overflow-hidden rounded border bg-gray-100"
            >
              <img
                src={publicUrl(
                  thumb(sp.photo.storage_key, sp.photo.photo_variants ?? []),
                )}
                alt={sp.photo.title}
                className="h-full w-full object-cover"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 opacity-0 transition group-hover:opacity-100">
                <p className="px-1 text-center text-[10px] text-gray-200">
                  @{sp.contributor?.username ?? "?"}
                </p>
                <Link
                  href={`/photos/${sp.photo.id}`}
                  className="rounded bg-white/90 px-2 py-0.5 text-xs font-medium hover:bg-white"
                >
                  View
                </Link>
                {sp.contributor_id === currentUserId && (
                  <button
                    onClick={() => removePhoto(sp.photo.id)}
                    disabled={removeBusy === sp.photo.id}
                    className="rounded bg-red-600/90 px-2 py-0.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {removeBusy === sp.photo.id ? "…" : "Remove"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm italic text-gray-400">
          No photos for this step yet.
        </p>
      )}

      {/* Trigger */}
      {currentUserId && !showAdd && (
        <button
          onClick={openAdd}
          className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          + Add your photo to this step
        </button>
      )}

      {/* Contributor panel */}
      {showAdd && (
        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-2">
              {(["existing", "upload"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded px-3 py-1 text-sm ${
                    tab === t
                      ? "bg-black text-white"
                      : "border hover:bg-gray-50"
                  }`}
                >
                  {t === "existing" ? "My photos" : "Upload new"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAdd(false)}
              className="text-xs text-gray-500 hover:underline"
            >
              Cancel
            </button>
          </div>

          {error && (
            <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {/* ── My photos tab ─────────────────────────────────────────── */}
          {tab === "existing" &&
            (userPhotos === null ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : userPhotos.length === 0 ? (
              <p className="text-sm text-gray-500">
                No public photos yet.{" "}
                <Link href="/upload" className="underline">
                  Upload one.
                </Link>
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {userPhotos.map((p) => {
                  const isAdded = addedIds.has(p.id);
                  const isPending = addBusy === p.id;
                  return (
                    <button
                      key={p.id}
                      disabled={isAdded || !!addBusy}
                      onClick={() => addPhoto(p.id)}
                      title={p.title}
                      className="group relative aspect-square overflow-hidden rounded border bg-gray-100 disabled:cursor-default"
                    >
                      <img
                        src={publicUrl(
                          thumb(p.storage_key, p.photo_variants ?? []),
                        )}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                      {isAdded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-[10px] font-semibold text-white">
                            Added ✓
                          </span>
                        </div>
                      )}
                      {isPending && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-xs text-white">…</span>
                        </div>
                      )}
                      {!isAdded && !isPending && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                          <span className="text-[10px] font-semibold text-white">
                            Select
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

          {/* ── Upload new tab ────────────────────────────────────────── */}
          {tab === "upload" && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Title
                </label>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Photo
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
                {uploadPreview && (
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="mt-2 max-h-40 rounded object-contain"
                  />
                )}
              </div>
              <button
                onClick={uploadAndAdd}
                disabled={uploadBusy || !uploadFile}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {uploadBusy ? "Uploading…" : "Upload & add to step"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
