import type { CommuneProperties } from "@/lib/types";

// Le champ de recherche vit dans AuthHeader (zone stable, jamais recouverte
// par le panneau latéral ni par "Mes artisans"), mais doit faire recentrer la
// carte dans CommunesMap, un composant frère hors de sa portée React — d'où
// cet event window, sur le même principe que QUOTA_UPDATED_EVENT.
export const COMMUNE_SELECTED_EVENT = "artisa:commune-selected";

export function notifyCommuneSelected(commune: CommuneProperties) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CommuneProperties>(COMMUNE_SELECTED_EVENT, { detail: commune }));
}
