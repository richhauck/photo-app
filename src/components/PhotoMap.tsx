"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Map, { Marker } from "react-map-gl/maplibre";
import { useState, useEffect } from "react";

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster" as const, source: "osm" }],
};

type ViewState = { longitude: number; latitude: number; zoom: number };

const WORLD_VIEW: ViewState = { longitude: 0, latitude: 20, zoom: 1 };

export default function PhotoMap({
  lat,
  lng,
  label,
}: {
  lat?: number;
  lng?: number;
  label?: string | null;
}) {
  const hasPin = lat != null && lng != null;

  const [initialView, setInitialView] = useState<ViewState | null>(
    hasPin
      ? { longitude: lng as number, latitude: lat as number, zoom: 4 }
      : null,
  );

  useEffect(() => {
    if (hasPin || initialView) return;
    if (!navigator.geolocation) {
      setInitialView(WORLD_VIEW);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setInitialView({
          longitude: pos.coords.longitude,
          latitude: pos.coords.latitude,
          zoom: 12,
        }),
      () => setInitialView(WORLD_VIEW),
      { timeout: 5000 },
    );
  }, []);

  if (!initialView) {
    return (
      <div
        className="overflow-hidden rounded-lg border bg-gray-100 animate-pulse"
        style={{ height: 280 }}
      />
    );
  }

  return (
    <div>
      <div
        className="overflow-hidden rounded-lg border"
        style={{ height: 280 }}
      >
        <Map
          initialViewState={initialView}
          style={{ width: "100%", height: "100%" }}
          mapStyle={OSM_STYLE}
        >
          {hasPin && (
            <Marker
              longitude={lng as number}
              latitude={lat as number}
              anchor="bottom"
            >
              <div
                title={label ?? undefined}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50% 50% 50% 0",
                  transform: "rotate(-45deg)",
                  background: "#e63946",
                  border: "2px solid #fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,.4)",
                }}
              />
            </Marker>
          )}
        </Map>
      </div>
      <p className="mt-1 text-center text-xs text-gray-500">
        Map data ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          OpenStreetMap
        </a>{" "}
        contributors
      </p>
    </div>
  );
}
