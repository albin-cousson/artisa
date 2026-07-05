export type Smiley = "green" | "orange" | "red";

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

export interface ArtisanRating {
  artisan_id: string;
  green_count: number;
  orange_count: number;
  red_count: number;
  total_count: number;
  average_score: number | null;
}

export interface ArtisanWithRating extends Artisan {
  rating: ArtisanRating | null;
}

export interface Review {
  id: string;
  artisan_id: string;
  user_id: string;
  content: string;
  smiley: Smiley;
  created_at: string;
}

export interface CommuneProperties {
  code: string;
  nom: string;
  codePostal: string | null;
  population: number | null;
  lat: number;
  lng: number;
}
