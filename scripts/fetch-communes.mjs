// Récupère une fois la liste complète des communes françaises (geo.api.gouv.fr)
// et la convertit en GeoJSON pour alimenter la carte (source statique, pas d'appel
// à chaque visite : les communes changent rarement).
//
// Usage : node scripts/fetch-communes.mjs

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "public", "communes.geojson.json");

const ENDPOINT =
  "https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,centre,population&format=json&geometry=centre";

async function main() {
  console.log("Téléchargement des communes depuis geo.api.gouv.fr...");
  const res = await fetch(ENDPOINT);
  if (!res.ok) {
    throw new Error(`Échec de la requête geo.api.gouv.fr : ${res.status} ${res.statusText}`);
  }
  const communes = await res.json();
  console.log(`${communes.length} communes reçues.`);

  const featureCollection = {
    type: "FeatureCollection",
    features: communes
      .filter((c) => c.centre) // quelques COM/collectivités n'ont pas de centre
      .map((c) => ({
        type: "Feature",
        geometry: c.centre,
        properties: {
          code: c.code,
          nom: c.nom,
          codePostal: c.codesPostaux?.[0] ?? null,
          population: c.population ?? null,
        },
      })),
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(featureCollection));
  console.log(`Écrit ${featureCollection.features.length} features dans ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
