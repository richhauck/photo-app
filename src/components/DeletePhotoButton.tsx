"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeletePhotoButton({ photoId }: { photoId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Delete failed");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-sm text-red-600 hover:underline"
      >
        Delete photo
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <p className="text-sm text-gray-700">Delete this photo permanently?</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}
