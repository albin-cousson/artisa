"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommuneProperties } from "@/lib/types";
import { normalizeForSearch } from "@/lib/text";

interface RawFeature {
  properties: { code: string; nom: string; codePostal: string | null; population: number | null };
  geometry: { coordinates: [number, number] };
}

export function CommuneSearch({ onSelect }: { onSelect: (commune: CommuneProperties) => void }) {
  const [communes, setCommunes] = useState<CommuneProperties[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/communes.geojson.json")
      .then((res) => res.json())
      .then((data: { features: RawFeature[] }) => {
        setCommunes(
          data.features.map((feature) => ({
            code: feature.properties.code,
            nom: feature.properties.nom,
            codePostal: feature.properties.codePostal,
            population: feature.properties.population,
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
          })),
        );
      });
  }, []);

  const results = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (q.length < 2) return [];
    return communes.filter((commune) => normalizeForSearch(commune.nom).includes(q)).slice(0, 8);
  }, [communes, query]);

  return (
    <div className="relative w-full">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Chercher une commune…"
        className="w-full rounded-lg border border-border bg-bg/95 px-3 py-2 text-sm text-ink shadow-[var(--shadow-popover)] backdrop-blur focus:border-accent focus:outline-none coarse:min-h-11"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-bg/95 shadow-[var(--shadow-popover)] backdrop-blur">
          {results.map((commune) => (
            <button
              key={commune.code}
              type="button"
              onClick={() => {
                onSelect(commune);
                setQuery("");
                setOpen(false);
              }}
              className="focus-ring block w-full truncate px-3 py-2 text-left text-sm hover:bg-primary-wash/60 coarse:min-h-11"
            >
              {commune.nom} <span className="text-xs text-muted">{commune.codePostal}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
