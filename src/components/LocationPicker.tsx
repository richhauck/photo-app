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

const PIN: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "50% 50% 50% 0",
  transform: "rotate(-45deg)",
  background: "#e63946",
  border: "2px solid #fff",
  boxShadow: "0 2px 6px rgba(0,0,0,.4)",
};

export default function LocationPicker({
  lat,
  lng,
  onChange,
}: {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
}) {
  const pinLat = parseFloat(lat);
  const pinLng = parseFloat(lng);
  const hasPin = lat !== "" && lng !== "" && !isNaN(pinLat) && !isNaN(pinLng);

  return (
    <div className="overflow-hidden rounded-lg border" style={{ height: 300 }}>
      <Map
        initialViewState={{ longitude: 0, latitude: 20, zoom: 1 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={OSM_STYLE}
        cursor="crosshair"
        onClick={(e) =>
          onChange(
            e.lngLat.lat.toFixed(6),
            e.lngLat.lng.toFixed(6),
          )
        }
      >
        {hasPin && (
          <Marker longitude={pinLng} latitude={pinLat} anchor="bottom">
            <div style={PIN} />
          </Marker>
        )}
      </Map>
    </div>
  );
}
