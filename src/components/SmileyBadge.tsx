import type { ArtisanRating } from "@/lib/types";

const SMILEY = { green: "🟢", orange: "🟠", red: "🔴" };

export function SmileyBadge({ rating }: { rating: ArtisanRating | null }) {
  if (!rating || rating.total_count === 0) {
    return (
      <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50 dark:bg-white/10 dark:text-white/50">
        Pas encore d&apos;avis
      </span>
    );
  }

  const dominant =
    (rating.average_score ?? 0) >= 0.75
      ? "green"
      : (rating.average_score ?? 0) >= 0.4
        ? "orange"
        : "red";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium dark:bg-white/10"
      title={`${rating.green_count} 🟢 · ${rating.orange_count} 🟠 · ${rating.red_count} 🔴`}
    >
      {SMILEY[dominant]} {rating.total_count} avis
    </span>
  );
}
