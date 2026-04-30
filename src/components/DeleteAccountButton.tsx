"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CONFIRM_PHRASE = "delete my account";

export default function DeleteAccountButton() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/account", { method: "DELETE" });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut().catch(() => null);
    router.push("/");
    router.refresh();
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="text-sm text-red-600 hover:underline"
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-red-800">Delete account</h3>
        <p className="mt-1 text-sm text-red-700">
          This permanently deletes your account, all your photos, expeditions,
          and any uploaded files. This cannot be undone.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-red-800 mb-1">
          Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to confirm
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder={CONFIRM_PHRASE}
          className="w-full rounded border border-red-300 bg-white px-3 py-2 text-sm placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
        />
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => {
            setStep("idle");
            setInput("");
            setError(null);
          }}
          disabled={busy}
          className="rounded border px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={busy || input.toLowerCase() !== CONFIRM_PHRASE}
          className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Deleting…" : "Permanently delete account"}
        </button>
      </div>
    </div>
  );
}
