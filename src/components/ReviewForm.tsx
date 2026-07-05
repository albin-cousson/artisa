"use client";

import { useState } from "react";
import { submitReview } from "@/actions/reviews";
import type { Smiley } from "@/lib/types";

const OPTIONS: { value: Smiley; emoji: string; label: string }[] = [
  { value: "green", emoji: "🟢", label: "Recommandé" },
  { value: "orange", emoji: "🟠", label: "Mitigé" },
  { value: "red", emoji: "🔴", label: "À éviter" },
];

export function ReviewForm({ artisanId, onDone }: { artisanId: string; onDone: () => void }) {
  const [content, setContent] = useState("");
  const [smiley, setSmiley] = useState<Smiley | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!smiley || !content.trim()) {
      setError("Choisis un smiley et écris un court avis.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const result = await submitReview({ artisanId, content: content.trim(), smiley });

    setSubmitting(false);
    if (result.error) {
      setError("Une erreur est survenue, réessaie.");
      return;
    }
    onDone();
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/10">
      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSmiley(opt.value)}
            className={`flex-1 rounded-md border px-2 py-1 text-sm transition ${
              smiley === opt.value
                ? "border-black bg-black/5 dark:border-white dark:bg-white/10"
                : "border-black/10 dark:border-white/10"
            }`}
          >
            {opt.emoji} {opt.label}
          </button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ton avis sur cet artisan..."
        maxLength={2000}
        rows={3}
        className="rounded-md border border-black/15 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black/30"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Envoi..." : "Publier l'avis"}
        </button>
      </div>
    </div>
  );
}
