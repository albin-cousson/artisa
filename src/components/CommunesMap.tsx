"use client";

import { useCallback, useRef, useState } from "react";
import {
  Map,
  Source,
  Layer,
  type MapRef,
  type MapLayerMouseEvent,
  type LayerProps,
} from "@vis.gl/react-maplibre";
import type { GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CommuneProperties } from "@/lib/types";
import { ArtisanPanel } from "@/components/ArtisanPanel";
import { UnlockedArtisansMenu } from "@/components/UnlockedArtisansMenu";
import { LoginPromptModal } from "@/components/LoginPromptModal";
import { useAuth } from "@/lib/supabase/auth-context";
import { useCalledArtisans } from "@/lib/useCalledArtisans";

const clusterLayer: LayerProps = {
  id: "clusters",
  type: "circle",
  source: "communes",
  filter: ["has", "point_count"],
  paint: {
    // Rampe séquentielle terracotta : plus le cluster est gros, plus il fonce.
    "circle-color": [
      "step",
      ["get", "point_count"],
      "#e0a486",
      50,
      "#c56a44",
      500,
      "#984a2b",
    ],
    "circle-radius": ["step", ["get", "point_count"], 16, 50, 24, 500, 32],
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
  },
};

const clusterCountLayer: LayerProps = {
  id: "cluster-count",
  type: "symbol",
  source: "communes",
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-size": 12,
    "text-font": ["Noto Sans Bold"],
  },
  paint: {
    "text-color": "#ffffff",
  },
};

const unclusteredPointLayer: LayerProps = {
  id: "unclustered-point",
  type: "circle",
  source: "communes",
  filter: ["!", ["has", "point_count"]],
  paint: {
    // Terracotta de marque (≈ oklch(0.55 0.14 40)) : un point = un prospect.
    "circle-color": "#c15f3b",
    "circle-radius": 6,
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#ffffff",
  },
};

export function CommunesMap() {
  const mapRef = useRef<MapRef>(null);
  const { user } = useAuth();
  const [selectedCommune, setSelectedCommune] = useState<CommuneProperties | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const called = useCalledArtisans();

  const onClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const map = mapRef.current?.getMap();
      if (!map) return;

      if (feature.properties?.cluster) {
        const clusterId = feature.properties.cluster_id as number;
        const source = map.getSource("communes") as GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom,
            duration: 500,
          });
        });
        return;
      }

      if (!user) {
        setShowLoginPrompt(true);
        return;
      }

      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      setSelectedCommune({ ...(feature.properties as CommuneProperties), lat, lng });
    },
    [user]
  );

  const onMouseEnter = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "pointer";
  }, []);

  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "";
  }, []);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 2.4, latitude: 46.6, zoom: 5.2 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/liberty"
        interactiveLayerIds={["clusters", "unclustered-point"]}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <Source
          id="communes"
          type="geojson"
          data="/communes.geojson.json"
          cluster={true}
          clusterMaxZoom={13}
          clusterRadius={60}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>
      </Map>

      {user && (
        <UnlockedArtisansMenu
          onOpenCommune={(commune) => setSelectedCommune(commune)}
          calledIds={called.calledIds}
          togglingId={called.togglingId}
          onMarkCalledIds={called.markCalledIds}
          onToggleCalled={called.toggleCalled}
        />
      )}

      {selectedCommune && (
        <ArtisanPanel
          key={selectedCommune.code}
          commune={selectedCommune}
          onClose={() => setSelectedCommune(null)}
          calledIds={called.calledIds}
          togglingId={called.togglingId}
          onMarkCalledIds={called.markCalledIds}
          onToggleCalled={called.toggleCalled}
        />
      )}

      {showLoginPrompt && <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />}
    </div>
  );
}
