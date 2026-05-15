"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Map, { Marker } from "react-map-gl/maplibre";
import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";

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
type BoundsState = {
  bounds: [[number, number], [number, number]];
  fitBoundsOptions: { padding: number };
};

export type MapPin = {
  lat: number;
  lng: number;
  label?: string | null;
  number?: number;
};

export type PhotoMapHandle = {
  zoomToPin: (pinIndex: number) => void;
};

const WORLD_VIEW: ViewState = { longitude: 0, latitude: 20, zoom: 1 };

function boundsFromPins(pins: MapPin[]): BoundsState {
  const lngs = pins.map((p) => p.lng);
  const lats = pins.map((p) => p.lat);
  return {
    bounds: [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    fitBoundsOptions: { padding: 60 },
  };
}

const PhotoMap = forwardRef<PhotoMapHandle, { pins?: MapPin[] }>(
  function PhotoMapComponent({ pins = [] }, ref) {
    const hasPins = pins.length > 0;

    const [geoView, setGeoView] = useState<ViewState | null>(null);
    const mapRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      zoomToPin: (pinIndex: number) => {
        if (pinIndex >= 0 && pinIndex < pins.length && mapRef.current) {
          const pin = pins[pinIndex];
          mapRef.current.flyTo({
            center: [pin.lng, pin.lat],
            zoom: 14,
            duration: 1000,
          });
        }
      },
    }));

    useEffect(() => {
      if (hasPins || geoView) return;
      if (!navigator.geolocation) {
        setGeoView(WORLD_VIEW);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setGeoView({
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
            zoom: 12,
          }),
        () => setGeoView(WORLD_VIEW),
        { timeout: 5000 },
      );
    }, []);

    const initialViewState: ViewState | BoundsState | null = hasPins
      ? pins.length === 1
        ? { longitude: pins[0].lng, latitude: pins[0].lat, zoom: 10 }
        : boundsFromPins(pins)
      : geoView;

    if (!initialViewState) {
      return (
        <div
          className="animate-pulse overflow-hidden rounded-lg border bg-gray-100"
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
            ref={mapRef}
            initialViewState={initialViewState}
            style={{ width: "100%", height: "100%" }}
            mapStyle={OSM_STYLE}
          >
            {pins.map((pin, i) => (
              <Marker
                key={i}
                longitude={pin.lng}
                latitude={pin.lat}
                anchor="center"
              >
                <div
                  title={pin.label ?? undefined}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#e63946",
                    border: "2px solid #fff",
                    boxShadow: "0 2px 6px rgba(0,0,0,.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {pin.number ?? ""}
                </div>
              </Marker>
            ))}
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
  },
);

PhotoMap.displayName = "PhotoMap";

export default PhotoMap;
