"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil2Icon } from "@radix-ui/react-icons";
import { Dialog } from "@radix-ui/themes";
import LocationPicker from "@/components/LocationPicker";

type Props = {
  photoId: string;
  initialDescription: string | null;
  initialLat: number | null;
  initialLng: number | null;
  initialLocationName: string | null;
};

export default function EditPhotoButton({
  photoId,
  initialDescription,
  initialLat,
  initialLng,
  initialLocationName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [lat, setLat] = useState(initialLat != null ? String(initialLat) : "");
  const [lng, setLng] = useState(initialLng != null ? String(initialLng) : "");
  const [locationName, setLocationName] = useState(initialLocationName ?? "");
  const [showPicker, setShowPicker] = useState(
    initialLat != null && initialLng != null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setDescription(initialDescription ?? "");
      setLat(initialLat != null ? String(initialLat) : "");
      setLng(initialLng != null ? String(initialLng) : "");
      setLocationName(initialLocationName ?? "");
      setShowPicker(initialLat != null && initialLng != null);
      setError(null);
    }
    setOpen(next);
  }

  async function save() {
    setBusy(true);
    setError(null);

    const hasPin = lat !== "" && lng !== "";
    const payload = {
      description: description || null,
      lat: hasPin ? Number(lat) : null,
      lng: hasPin ? Number(lng) : null,
      locationName: locationName || null,
    };

    const res = await fetch(`/api/photos/${photoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.refresh();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
    }
    setBusy(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>
        <button className="text-sm text-gray-600 hover:underline">
          <Pencil2Icon className="mr-1 inline-block" />
          Edit photo
        </button>
      </Dialog.Trigger>

      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Edit photo</Dialog.Title>

        <div className="space-y-4 mt-2">
          {error && (
            <p className="rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={5000}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="text-xs text-blue-600 underline"
            >
              {showPicker ? "Hide map" : "Edit location"}
            </button>

            {showPicker && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-gray-500">
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
                  <div className="flex items-center justify-between">
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
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="Location name (e.g. Central Park, NY)"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  maxLength={200}
                />
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Dialog.Close>
            <button
              disabled={busy}
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </Dialog.Close>
          <button
            onClick={save}
            disabled={busy}
            className="rounded bg-black px-3 py-1 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
