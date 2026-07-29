-- Signaux supplémentaires calculés à partir du même fetch déjà fait pour
-- is_reachable/has_viewport_meta (voir src/lib/siteCheck.ts) : aucun coût
-- réseau additionnel, juste plus de regex sur le HTML déjà récupéré.
alter table public.artisan_site_checks
  add column is_https boolean,
  add column has_seo_tags boolean,
  add column has_social_links boolean,
  add column has_booking_widget boolean,
  add column has_contact_form boolean,
  add column has_clickable_phone boolean,
  add column has_ecommerce boolean,
  add column has_chatbot boolean,
  add column has_analytics boolean,
  add column has_review_widget boolean,
  add column has_obsolete_tech boolean;
