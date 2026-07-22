"use client";

import { useCallback, useState } from "react";
import { getCalledArtisanIds, setArtisanCalled } from "@/actions/calls";

/**
 * État "déjà appelé" partagé entre le panneau de commune et "Mes artisans" :
 * un même artisan peut être visible dans les deux à la fois, donc cocher dans
 * l'un doit se refléter immédiatement dans l'autre — d'où l'état levé ici
 * plutôt que dupliqué localement dans chaque composant.
 */
export function useCalledArtisans() {
  const [calledIds, setCalledIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const markCalledIds = useCallback((artisanIds: string[]) => {
    if (artisanIds.length === 0) return;
    getCalledArtisanIds(artisanIds).then((called) => {
      if (called.length === 0) return;
      setCalledIds((prev) => new Set([...prev, ...called]));
    });
  }, []);

  const toggleCalled = useCallback((artisanId: string, called: boolean) => {
    setTogglingId(artisanId);
    setArtisanCalled(artisanId, called).then((result) => {
      setTogglingId(null);
      if (result.error) return;
      setCalledIds((prev) => {
        const next = new Set(prev);
        if (called) next.add(artisanId);
        else next.delete(artisanId);
        return next;
      });
    });
  }, []);

  return { calledIds, togglingId, markCalledIds, toggleCalled };
}
