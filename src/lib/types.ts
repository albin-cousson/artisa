export interface Artisan {
  id: string;
  place_id: string;
  commune_code: string;
  display_name: string;
  national_phone_number: string | null;
  google_maps_uri: string | null;
  website_uri: string | null;
  category: string | null;
}

export interface CommuneProperties {
  code: string;
  nom: string;
  codePostal: string | null;
  population: number | null;
  lat: number;
  lng: number;
}
