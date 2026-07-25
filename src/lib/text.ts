// Normalisation pour recherche insensible aux accents/casse (ex. "etretat"
// doit matcher "Étretat"). Utilisé par CommuneSearch et UnlockedArtisansMenu.
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}
