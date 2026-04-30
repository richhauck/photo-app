"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import LocationPicker from "@/components/LocationPicker";

type Step = {
  description: string;
  locationName: string;
  lat: string;
  lng: string;
  showPicker: boolean;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not load image")); };
    img.src = objectUrl;
  });
}

async function resizeToAvif(file: File, maxW: number, maxH: number): Promise<File> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("AVIF conversion failed"));
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".avif"), { type: "image/avif" }));
      },
      "image/avif",
      0.8,
    );
  });
}

function emptyStep(): Step {
  return { description: "", locationName: "", lat: "", lng: "", showPicker: false };
}

export default function CreateExpeditionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [badgePreview, setBadgePreview] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([emptyStep()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(title));
  }, [title, slugManual]);

  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (!badgeFile) { setBadgePreview(null); return; }
    const url = URL.createObjectURL(badgeFile);
    setBadgePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [badgeFile]);

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      async function uploadAvif(file: File, maxW: number, maxH: number, label: string) {
        const avif = await resizeToAvif(file, maxW, maxH);
        const urlRes = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: avif.name, contentType: avif.type, sizeBytes: avif.size }),
        });
        if (!urlRes.ok) throw new Error(`Could not get ${label} upload URL`);
        const { url, key } = (await urlRes.json()) as { url: string; key: string };
        const r2Res = await fetch(url, { method: "PUT", headers: { "Content-Type": avif.type }, body: avif });
        if (!r2Res.ok) throw new Error(`${label} upload failed`);
        return key;
      }

      const [coverStorageKey, badgeStorageKey] = await Promise.all([
        coverFile ? uploadAvif(coverFile, 1920, 1080, "Cover") : Promise.resolve(undefined),
        badgeFile ? uploadAvif(badgeFile, 512, 512, "Badge") : Promise.resolve(undefined),
      ]);

      const payload = {
        slug,
        title,
        description: description || undefined,
        coverStorageKey,
        badgeStorageKey,
        steps: steps
          .filter((s) => s.description.trim())
          .map((s) => ({
            description: s.description,
            locationName: s.locationName || undefined,
            lat: s.lat ? Number(s.lat) : undefined,
            lng: s.lng ? Number(s.lng) : undefined,
          })),
      };

      const res = await fetch("/api/expeditions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create expedition");
      }

      const { slug: newSlug } = (await res.json()) as { slug: string };
      router.push(`/expeditions/${newSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

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
        <label className="mb-1 block text-sm font-medium">Slug</label>
        <input
          className="w-full rounded border px-3 py-2 font-mono text-sm"
          value={slug}
          onChange={(e) => { setSlug(slugify(e.target.value)); setSlugManual(true); }}
          maxLength={200}
          pattern="[a-z0-9-]+"
          required
        />
        <p className="mt-1 text-xs text-gray-500">URL: /expeditions/{slug || "…"}</p>
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
        <label className="mb-1 block text-sm font-medium">Cover photo (optional)</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
        />
        {coverPreview && (
          <img
            src={coverPreview}
            alt="Cover preview"
            className="mt-3 max-h-48 w-full rounded object-cover"
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Badge (optional)</label>
        <p className="mb-2 text-xs text-gray-500">
          A small emblem or icon that represents this expedition.
        </p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(e) => setBadgeFile(e.target.files?.[0] ?? null)}
        />
        {badgePreview && (
          <img
            src={badgePreview}
            alt="Badge preview"
            className="mt-3 h-24 w-24 rounded-lg object-cover border"
          />
        )}
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Steps</legend>

        {steps.map((step, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Step {i + 1}</span>
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="text-xs text-red-600 underline"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                <textarea
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={step.description}
                  onChange={(e) => updateStep(i, { description: e.target.value })}
                  rows={2}
                  maxLength={5000}
                  required={i === 0}
                  placeholder={i === 0 ? "Describe this step…" : "Describe this step (optional)"}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => updateStep(i, { showPicker: !step.showPicker })}
                  className="text-xs text-blue-600 underline"
                >
                  {step.showPicker ? "Hide map" : "Add location (optional)"}
                </button>

                {step.showPicker && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500">Click the map to drop a pin.</p>
                    <LocationPicker
                      lat={step.lat}
                      lng={step.lng}
                      onChange={(lat, lng) => updateStep(i, { lat, lng })}
                    />
                    {step.lat && step.lng && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {step.lat}, {step.lng}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateStep(i, { lat: "", lng: "" })}
                          className="text-xs text-red-600 underline"
                        >
                          Clear pin
                        </button>
                      </div>
                    )}
                    <input
                      className="w-full rounded border px-3 py-2 text-sm"
                      placeholder="Location name (e.g. Central Park, NY)"
                      value={step.locationName}
                      onChange={(e) => updateStep(i, { locationName: e.target.value })}
                      maxLength={200}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addStep}
          className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
        >
          + Add step
        </button>
      </fieldset>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-black py-2 text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create expedition"}
      </button>
    </form>
  );
}
