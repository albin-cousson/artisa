"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_MODE_ID, isArtisanModeId, type ArtisanModeId } from "@/lib/artisanModes";

const STORAGE_KEY = "artisa:mode";

interface ModeContextValue {
  mode: ArtisanModeId;
  setMode: (mode: ArtisanModeId) => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: DEFAULT_MODE_ID,
  setMode: () => {},
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ArtisanModeId>(DEFAULT_MODE_ID);

  useEffect(() => {
    // localStorage n'existe pas côté serveur : on démarre sur le mode par
    // défaut (identique au rendu serveur) puis on resynchronise ici après le
    // montage, une fois côté client.
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isArtisanModeId(stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lit une préférence client-only après le premier rendu, pas de mismatch d'hydratation possible
      setModeState(stored);
    }
  }, []);

  function setMode(next: ArtisanModeId) {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

export function useArtisanMode() {
  return useContext(ModeContext);
}
