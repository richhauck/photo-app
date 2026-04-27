"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Map, { Marker } from "react-map-gl/maplibre";

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

export default function PhotoMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label?: string | null;
}) {
  return (
    <div>
      <div className="overflow-hidden rounded-lg border" style={{ height: 280 }}>
        <Map
          initialViewState={{ longitude: lng, latitude: lat, zoom: 12 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={OSM_STYLE}
        >
          <Marker longitude={lng} latitude={lat} anchor="bottom">
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
