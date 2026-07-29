// Normalisation pour recherche insensible aux accents/casse (ex. "etretat"
// doit matcher "Étretat"). Utilisé par CommuneSearch et UnlockedArtisansMenu.
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}

// Majuscule initiale seulement (ex. "peintre en bâtiment" -> "Peintre en
// bâtiment") — les métiers stockés en category (TRADE_SEARCH_QUERIES) sont en
// minuscules.
export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
